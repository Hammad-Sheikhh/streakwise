import type { ReactNode } from 'react';

import { trackSwatchClass } from '@/components/trackColors';
import type { Report } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import {
  formatDay,
  formatDaysLeft,
  formatRange,
  formatTimestamp,
  pluralDays,
  SCORE_KIND_LABELS,
} from '@/core/logic/labels';
import { APP_NAME, reportTitle } from '@/core/logic/reportFormat';
import { cn } from '@/lib/utils';

// REP-4: one look for the Reports screen, print (REP-6, §B10.3), and shared links (SHARE-2).
// It renders only the snapshot, so a shared link never needs anything else from the app.

type Level = 1 | 2;

function Heading({ level, children }: { level: Level; children: ReactNode }) {
  const Tag = level === 1 ? 'h2' : 'h3';
  return <Tag className="text-base font-semibold">{children}</Tag>;
}

function Block({ title, level, children }: { title: string; level: Level; children: ReactNode }) {
  return (
    <section className="flex break-inside-avoid flex-col gap-2">
      <Heading level={level}>{title}</Heading>
      {children}
    </section>
  );
}

const muted = 'text-muted-foreground print:text-neutral-600';
const tableClass = 'w-full border-collapse text-sm [&_td]:py-1.5 [&_th]:py-1.5 [&_th]:font-medium';

export function ReportView({
  report,
  titleLevel = 2,
}: {
  report: Report;
  /** 1 on the public page, where the report is the whole page. */
  titleLevel?: 1 | 2;
}) {
  const TitleTag = titleLevel === 1 ? 'h1' : 'h2';
  const level: Level = titleLevel === 1 ? 1 : 2;
  const { totals } = report;
  const stats = [
    { label: 'Time', value: formatDuration(totals.minutes) },
    { label: 'Sessions', value: String(totals.sessions) },
    { label: 'Active days', value: `${totals.activeDays} of ${totals.days}` },
    { label: 'Streak', value: pluralDays(totals.streak) },
  ];

  return (
    <article className="report flex flex-col gap-6 rounded-lg border p-4 sm:p-6 print:gap-5 print:border-0 print:p-0">
      <header className="flex flex-col gap-1 border-b pb-4 print:border-neutral-300">
        <p className={cn('text-xs tracking-wide uppercase', muted)}>{APP_NAME}</p>
        <TitleTag className="text-xl font-semibold tracking-tight">{reportTitle(report)}</TitleTag>
        <p className="font-medium">
          {report.studentName && `${report.studentName} · `}
          {report.period.label}: {formatRange(report.period.from, report.period.to)}
        </p>
        <p className={cn('text-sm', muted)}>Generated {formatTimestamp(report.generatedAt)}</p>
      </header>

      <Block title="Summary" level={level}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md border p-3 print:border-neutral-300">
              <dt className={cn('text-xs', muted)}>{s.label}</dt>
              <dd className="text-lg font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block title="Time by track" level={level}>
        {report.tracks.length === 0 ? (
          <p className={muted}>No tracks yet.</p>
        ) : (
          <table className={tableClass}>
            <thead>
              <tr className="border-b text-left print:border-neutral-300">
                <th scope="col">Track</th>
                <th scope="col" className="text-right">
                  Time
                </th>
                {report.period.isWeek && (
                  <th scope="col" className="text-right">
                    Target
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {report.tracks.map((track) => (
                <TrackRows key={track.name} track={track} showTarget={report.period.isWeek} />
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block title="Topics" level={level}>
        <List
          empty="No topics studied."
          items={report.topicsStudied.map((t) => `${t.path} · ${formatDuration(t.minutes)}`)}
          label="Studied"
        />
        <List
          empty="No topics marked done."
          items={report.topicsDone.map((t) => `${t.path} · ${formatDay(t.doneOn)}`)}
          label="Marked done"
        />
      </Block>

      <Block title="Tasks completed" level={level}>
        <List
          empty="No tasks completed."
          items={report.tasksCompleted.map((t) => {
            const score = t.score
              ? ` · ${t.score.score}/${t.score.maxScore} (${t.score.percent}%)`
              : '';
            return `${t.title}${t.path ? ` (${t.path})` : ''}${score} · ${formatDay(t.completedOn)}`;
          })}
        />
      </Block>

      <Block title="Scores" level={level}>
        {report.scores.length === 0 ? (
          <p className={muted}>No scores recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className="border-b text-left print:border-neutral-300">
                  <th scope="col">Date</th>
                  <th scope="col">Title</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.scores.map((s, i) => (
                  <tr key={i} className="border-b last:border-0 print:border-neutral-200">
                    <td className="pr-2 whitespace-nowrap">{formatDay(s.date)}</td>
                    <td className="pr-2">
                      {s.title}
                      <span className={cn('block text-xs', muted)}>{s.path}</span>
                    </td>
                    <td className="pr-2">{SCORE_KIND_LABELS[s.kind]}</td>
                    <td className="text-right whitespace-nowrap">
                      {s.score}/{s.maxScore} ({s.percent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block title="Needs attention" level={level}>
        <List
          empty="Nothing neglected."
          items={report.neglected.map(
            (n) =>
              `${n.path}: ${n.neverLogged ? 'never studied' : `${pluralDays(n.days)} untouched`}`,
          )}
        />
      </Block>

      <Block title="Upcoming deadlines" level={level}>
        <List
          empty="No upcoming deadlines."
          items={report.deadlines.map((d) => {
            const left =
              d.syllabusLeftPercent === null ? '' : ` · ${d.syllabusLeftPercent}% of syllabus left`;
            return `${d.title} (${d.path}): ${formatDay(d.dueOn)}, ${formatDaysLeft(d.daysLeft)}${left}`;
          })}
        />
      </Block>

      {report.includesNotes && (
        <Block title="Notes" level={level}>
          <List
            empty="No notes in this period."
            items={report.notes.map(
              (n) => `${formatDay(n.date)} · ${n.path} · ${formatDuration(n.minutes)}: ${n.note}`,
            )}
          />
        </Block>
      )}
    </article>
  );
}

function TrackRows({
  track,
  showTarget,
}: {
  track: Report['tracks'][number];
  showTarget: boolean;
}) {
  const target =
    track.targetMinutes === null
      ? '—'
      : `${formatDuration(track.targetMinutes)} (${track.targetPercent ?? 0}%)`;
  return (
    <>
      <tr className="border-b print:border-neutral-200">
        <th scope="row" className="text-left">
          <span className="flex items-center gap-2">
            {track.color && (
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 shrink-0 rounded-full print:[print-color-adjust:exact]',
                  trackSwatchClass[track.color],
                )}
              />
            )}
            {track.name}
          </span>
        </th>
        <td className="text-right font-medium">{formatDuration(track.minutes)}</td>
        {showTarget && <td className="text-right">{target}</td>}
      </tr>
      {track.subtasks.map((s) => (
        <tr key={s.name} className="border-b print:border-neutral-200">
          <td className={cn('pl-5', muted)}>{s.name}</td>
          <td className={cn('text-right', muted)}>{formatDuration(s.minutes)}</td>
          {showTarget && <td />}
        </tr>
      ))}
    </>
  );
}

function List({ items, empty, label }: { items: string[]; empty: string; label?: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {label && <p className="font-medium">{label}</p>}
      {items.length === 0 ? (
        <p className={muted}>{empty}</p>
      ) : (
        <ul className="list-disc pl-5">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
