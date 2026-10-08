import type { Report } from '../domain/types';
import { formatDuration } from './duration';
import {
  formatDay,
  formatDaysLeft,
  formatRange,
  formatTimestamp,
  pluralDays,
  SCORE_KIND_LABELS,
} from './labels';

// SPEC §B10.1–2: the report as WhatsApp text and as Markdown for Claude. Pure, so the app, demo
// mode, and tests produce exactly the same text.

export const APP_NAME = 'Streakwise';

/** "+N more" after the first `max` items. */
function capped(items: readonly string[], max: number): string[] {
  return items.length > max ? [...items.slice(0, max), `+${items.length - max} more`] : [...items];
}

/** The last part of a path, e.g. "English". */
const leaf = (path: string) => path.split(' > ').at(-1) ?? path;
/** The path without its track, e.g. "Maths Chapter 3" for a topic. */
const short = (path: string) => path.split(' > ').slice(1).join(' ') || path;

/** e.g. "Weekly study report". */
export function reportTitle(report: Report): string {
  const { kind } = report.period;
  if (kind === 'today' || kind === 'yesterday') return 'Daily study report';
  if (report.period.isWeek) return 'Weekly study report';
  return 'Study report';
}

function trackTime(track: Report['tracks'][number]): string {
  const time = formatDuration(track.minutes);
  return track.targetMinutes === null
    ? time
    : `${time} of ${formatDuration(track.targetMinutes)} (${track.targetPercent ?? 0}%)`;
}

function deadlineText(d: Report['deadlines'][number]): string {
  const left =
    d.syllabusLeftPercent === null ? '' : ` (${d.syllabusLeftPercent}% of syllabus left)`;
  return `${d.title} ${formatDaysLeft(d.daysLeft)}${left}`;
}

function scoreText(score: { score: number; maxScore: number }): string {
  return `${score.score}/${score.maxScore}`;
}

/** B10.1: short enough for a WhatsApp message (about 1,000 characters). */
export function reportAsWhatsApp(report: Report): string {
  const { totals, period } = report;
  const lines: string[] = [`*${reportTitle(report)}*`];
  const range = formatRange(period.from, period.to);
  lines.push(report.studentName ? `${report.studentName} · ${range}` : range);
  lines.push('');

  const days = totals.days > 1 ? `${totals.activeDays} of ${totals.days} days` : null;
  const sessions = `${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}`;
  lines.push(
    [
      `Total: ${formatDuration(totals.minutes)}`,
      days ?? sessions,
      `streak ${pluralDays(totals.streak)}`,
    ].join(' · '),
  );

  const tracks = report.tracks.filter((t) => t.minutes > 0 || t.targetMinutes !== null);
  if (tracks.length > 0) lines.push('');
  for (const track of tracks.slice(0, 6)) {
    lines.push(`*${track.name}* — ${trackTime(track)}`);
    const subtasks = track.subtasks.map((s) => `${s.name} ${formatDuration(s.minutes)}`);
    if (subtasks.length > 0) lines.push(capped(subtasks, 4).join(' · '));
  }
  if (tracks.length > 6) lines.push(`+${tracks.length - 6} more tracks`);

  const completed = [
    ...report.topicsDone.map((t) => short(t.path)),
    ...report.tasksCompleted.map((t) => (t.score ? `${t.title} ${scoreText(t.score)}` : t.title)),
  ];
  const extra: string[] = [];
  if (completed.length > 0) extra.push(`Completed: ${capped(completed, 4).join(' · ')}`);
  if (report.neglected.length > 0) {
    const items = report.neglected.map((n) => `${leaf(n.path)} (${pluralDays(n.days)})`);
    extra.push(`Needs attention: ${capped(items, 3).join(' · ')}`);
  }
  if (report.deadlines.length > 0) {
    extra.push(`Coming up: ${capped(report.deadlines.map(deadlineText), 2).join(' · ')}`);
  }
  if (extra.length > 0) lines.push('', ...extra);

  if (report.notes.length > 0) {
    const notes = report.notes.map((n) => `${leaf(n.path)}: ${n.note}`);
    lines.push('', 'Notes:', ...capped(notes, 3));
  }
  return lines.join('\n');
}

/** Table cells can't contain pipes or line breaks. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/** B10.2: Markdown with a closing prompt, for pasting into Claude. */
export function reportAsMarkdown(report: Report): string {
  const { totals, period } = report;
  const out: string[] = [
    `# Study report: ${period.label} (${formatRange(period.from, period.to)})`,
    '',
    [
      report.studentName ? `Student: ${report.studentName}` : null,
      `Generated: ${formatTimestamp(report.generatedAt)} (Asia/Karachi)`,
      APP_NAME,
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    '## Summary',
    `- Total time: ${formatDuration(totals.minutes)}`,
    `- Sessions: ${totals.sessions}`,
    `- Active days: ${totals.activeDays} of ${totals.days}`,
    `- Current streak: ${pluralDays(totals.streak)}`,
    '',
    '## Time by track',
  ];

  if (report.tracks.length === 0) out.push('No tracks.');
  else {
    out.push('| Track | Subtask | Time | Target | % |', '|---|---|---|---|---|');
    for (const track of report.tracks) {
      const target = track.targetMinutes === null ? '—' : formatDuration(track.targetMinutes);
      const percent = track.targetPercent === null ? '—' : `${track.targetPercent}%`;
      out.push(
        `| ${cell(track.name)} | (all) | ${formatDuration(track.minutes)} | ${target} | ${percent} |`,
      );
      for (const s of track.subtasks) {
        out.push(`| ${cell(track.name)} | ${cell(s.name)} | ${formatDuration(s.minutes)} | | |`);
      }
    }
  }

  out.push('', '## Topics');
  const studied = report.topicsStudied.map((t) => `${t.path} (${formatDuration(t.minutes)})`);
  out.push(`- Studied: ${studied.length > 0 ? studied.join('; ') : 'none'}`);
  const done = report.topicsDone.map((t) => `${t.path} (${formatDay(t.doneOn)})`);
  out.push(`- Marked done: ${done.length > 0 ? done.join('; ') : 'none'}`);

  out.push('', '## Tasks completed');
  if (report.tasksCompleted.length === 0) out.push('None.');
  for (const t of report.tasksCompleted) {
    const where = t.path ? ` (${t.path})` : '';
    const score = t.score ? ` — ${scoreText(t.score)} (${t.score.percent}%)` : '';
    out.push(`- ${formatDay(t.completedOn)}: ${t.title}${where}${score}`);
  }

  out.push('', '## Scores');
  if (report.scores.length === 0) out.push('None.');
  else {
    out.push('| Date | Node | Kind | Title | Score | % |', '|---|---|---|---|---|---|');
    for (const s of report.scores) {
      out.push(
        `| ${s.date} | ${cell(s.path)} | ${SCORE_KIND_LABELS[s.kind]} | ${cell(s.title)} | ${scoreText(s)} | ${s.percent}% |`,
      );
    }
  }

  out.push('', '## Needs attention');
  if (report.neglected.length === 0) out.push('Nothing neglected.');
  for (const n of report.neglected) {
    out.push(
      `- ${n.path}: ${n.neverLogged ? 'never studied' : 'not studied'} for ${pluralDays(n.days)}`,
    );
  }

  out.push('', '## Upcoming deadlines');
  if (report.deadlines.length === 0) out.push('None.');
  for (const d of report.deadlines) {
    const left =
      d.syllabusLeftPercent === null ? '' : `, ${d.syllabusLeftPercent}% of syllabus left`;
    out.push(
      `- ${d.title} (${d.path}): ${formatDay(d.dueOn)}, ${formatDaysLeft(d.daysLeft)}${left}`,
    );
  }

  if (report.includesNotes) {
    out.push('', '## Notes');
    if (report.notes.length === 0) out.push('No notes.');
    for (const n of report.notes) {
      out.push(
        `- ${formatDay(n.date)} · ${n.path} · ${formatDuration(n.minutes)}: ${cell(n.note)}`,
      );
    }
  }

  out.push(
    '',
    '---',
    'Analyse this period: what’s going well, what am I neglecting, and what should I prioritise next?',
  );
  return out.join('\n');
}
