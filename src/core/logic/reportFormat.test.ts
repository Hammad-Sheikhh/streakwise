import { describe, expect, it } from 'vitest';

import type { Report } from '../domain/types';
import { formatRange, formatTimestamp } from './labels';
import { reportAsMarkdown, reportAsWhatsApp } from './reportFormat';

function sampleReport(overrides: Partial<Report> = {}): Report {
  return {
    studentName: 'Demo Student',
    period: {
      kind: 'this_week',
      label: 'This week',
      from: '2026-09-28',
      to: '2026-10-04',
      isWeek: true,
    },
    generatedAt: '2026-10-03T10:05:00.000Z',
    includesNotes: false,
    totals: { minutes: 870, sessions: 12, activeDays: 6, days: 7, streak: 9 },
    tracks: [
      {
        name: 'Exam Prep',
        color: 'amber',
        minutes: 370,
        targetMinutes: 480,
        targetPercent: 77,
        subtasks: [
          { name: 'Flashcards', minutes: 280 },
          { name: 'Practice', minutes: 90 },
        ],
      },
      {
        name: 'Online Course',
        color: 'violet',
        minutes: 180,
        targetMinutes: 240,
        targetPercent: 75,
        subtasks: [],
      },
      {
        name: 'Hobby',
        color: 'slate',
        minutes: 0,
        targetMinutes: null,
        targetPercent: null,
        subtasks: [],
      },
    ],
    topicsStudied: [{ path: 'School Subjects > Maths > Ch. 3', minutes: 60 }],
    topicsDone: [{ path: 'School Subjects > Maths > Ch. 3', doneOn: '2026-10-02' }],
    tasksCompleted: [
      {
        title: 'Weekly self-test',
        path: 'Exam Prep',
        completedOn: '2026-10-03',
        score: { score: 18, maxScore: 20, percent: 90 },
      },
    ],
    scores: [
      {
        date: '2026-10-03',
        path: 'Exam Prep',
        kind: 'revision',
        title: 'Weekly | recall',
        score: 18,
        maxScore: 20,
        percent: 90,
      },
    ],
    neglected: [{ path: 'School Subjects > English', days: 4, neverLogged: false }],
    deadlines: [
      {
        title: 'Maths exam',
        path: 'School Subjects > Maths',
        dueOn: '2026-11-13',
        daysLeft: 41,
        syllabusLeftPercent: 62,
      },
    ],
    notes: [],
    ...overrides,
  };
}

describe('labels', () => {
  it('formats ranges and timestamps in Karachi time', () => {
    expect(formatRange('2026-09-29', '2026-10-05')).toBe('29 Sep – 5 Oct 2026');
    expect(formatRange('2025-12-29', '2026-01-04')).toBe('29 Dec 2025 – 4 Jan 2026');
    expect(formatRange('2026-10-03', '2026-10-03')).toBe('Sat 3 Oct 2026');
    expect(formatTimestamp('2026-10-03T19:30:00Z')).toBe('Sun 4 Oct 2026, 00:30');
  });
});

describe('reportAsWhatsApp (REP-7, §B10.1)', () => {
  it('follows the WhatsApp layout', () => {
    expect(reportAsWhatsApp(sampleReport())).toBe(
      [
        '*Weekly study report*',
        'Demo Student · 28 Sep – 4 Oct 2026',
        '',
        'Total: 14h 30m · 6 of 7 days · streak 9 days',
        '',
        '*Exam Prep* — 6h 10m of 8h (77%)',
        'Flashcards 4h 40m · Practice 1h 30m',
        '*Online Course* — 3h of 4h (75%)',
        '',
        'Completed: Maths Ch. 3 · Weekly self-test 18/20',
        'Needs attention: English (4 days)',
        'Coming up: Maths exam in 41 days (62% of syllabus left)',
      ].join('\n'),
    );
  });

  it('stays short with long lists, using "+N more"', () => {
    const neglected = Array.from({ length: 30 }, (_, i) => ({
      path: `Track > Subtask number ${i}`,
      days: 5,
      neverLogged: false,
    }));
    const tracks = Array.from({ length: 10 }, (_, i) => ({
      name: `Track ${i}`,
      color: null,
      minutes: 60,
      targetMinutes: null,
      targetPercent: null,
      subtasks: Array.from({ length: 8 }, (_, j) => ({ name: `Subtask ${j}`, minutes: 5 })),
    }));
    const text = reportAsWhatsApp(sampleReport({ neglected, tracks }));
    expect(text).toContain('+27 more');
    expect(text).toContain('+4 more tracks');
    expect(text.length).toBeLessThan(1000);
  });

  it('shows sessions instead of days for one day, and no name when it is empty', () => {
    const text = reportAsWhatsApp(
      sampleReport({
        studentName: '',
        period: {
          kind: 'today',
          label: 'Today',
          from: '2026-10-03',
          to: '2026-10-03',
          isWeek: false,
        },
        totals: { minutes: 45, sessions: 1, activeDays: 1, days: 1, streak: 1 },
      }),
    );
    expect(text.split('\n').slice(0, 4)).toEqual([
      '*Daily study report*',
      'Sat 3 Oct 2026',
      '',
      'Total: 45m · 1 session · streak 1 day',
    ]);
  });
});

describe('reportAsMarkdown (REP-8, §B10.2)', () => {
  it('has every section, tables, and the closing prompt', () => {
    const md = reportAsMarkdown(sampleReport());
    expect(md.startsWith('# Study report: This week (28 Sep – 4 Oct 2026)')).toBe(true);
    for (const heading of [
      '## Summary',
      '## Time by track',
      '## Topics',
      '## Tasks completed',
      '## Scores',
      '## Needs attention',
      '## Upcoming deadlines',
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).not.toContain('## Notes');
    expect(md).toContain('| Exam Prep | Flashcards | 4h 40m | | |');
    expect(md).toContain('| Exam Prep | (all) | 6h 10m | 8h | 77% |');
    // Pipes in titles don't break the table.
    expect(md).toContain('Weekly \\| recall');
    expect(md).toContain('- School Subjects > English: not studied for 4 days');
    expect(md.trimEnd().endsWith('what should I prioritise next?')).toBe(true);
  });

  it('adds a Notes section when notes are included', () => {
    const md = reportAsMarkdown(
      sampleReport({
        includesNotes: true,
        notes: [
          { date: '2026-10-01', path: 'Exam Prep > Flashcards', minutes: 30, note: 'Dative' },
        ],
      }),
    );
    expect(md).toContain('## Notes\n- Thu 1 Oct 2026 · Exam Prep > Flashcards · 30m: Dative');
  });
});
