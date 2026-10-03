import { describe, expect, it } from 'vitest';

import type { SessionFact, TreeNode } from '../domain/types';
import { heatLevel, heatmapRange, heatmapWeeks } from './heatmap';
import { neglectWarnings } from './neglect';
import { dailyTotals, latestDateByNode, minutesByNode } from './rollup';
import { currentStreak, longestStreak } from './streak';
import { syllabus, syllabusPercent } from './syllabus';
import { isBehindPace, targetProgress } from './targets';

function node(id: string, parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode {
  const depth = (parentId === null ? 1 : parentId.length + 1) as TreeNode['depth'];
  return {
    id,
    parentId,
    depth,
    name: id,
    color: depth === 1 ? 'amber' : null,
    sortOrder: 0,
    weeklyTargetMinutes: null,
    topicStatus: depth === 3 ? 'not_started' : null,
    topicDoneAt: null,
    archivedAt: null,
    // 2026-09-01 05:00 in Karachi.
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...extra,
  };
}

// Ids double as paths: "a" track, "ab"/"ac" subtasks, "abx"/"aby" topics under "ab", "d" a track.
const nodes = [
  node('a', null),
  node('ab', 'a'),
  node('abx', 'ab'),
  node('aby', 'ab'),
  node('ac', 'a'),
  node('d', null),
];
const fact = (nodeId: string, studiedOn: string, minutes = 30): SessionFact => ({
  nodeId,
  studiedOn,
  minutes,
});

describe('roll-up (§B9.3)', () => {
  const facts = [
    fact('abx', '2026-10-01', 20),
    fact('ab', '2026-10-02', 40),
    fact('d', '2026-10-03'),
  ];

  it('counts a session for its node and every ancestor', () => {
    const totals = minutesByNode(nodes, facts);
    expect(totals.get('abx')).toBe(20);
    expect(totals.get('ab')).toBe(60);
    expect(totals.get('a')).toBe(60);
    expect(totals.get('ac')).toBeUndefined();
    expect(totals.get('d')).toBe(30);
  });

  it('limits to a date range', () => {
    expect(minutesByNode(nodes, facts, { from: '2026-10-02' }).get('a')).toBe(40);
    expect(minutesByNode(nodes, facts, { to: '2026-10-01' }).get('a')).toBe(20);
  });

  it('finds the latest date per subtree and totals per day', () => {
    const latest = latestDateByNode(nodes, facts);
    expect(latest.get('a')).toBe('2026-10-02');
    expect(latest.get('abx')).toBe('2026-10-01');
    expect(dailyTotals([...facts, fact('d', '2026-10-03', 15)]).get('2026-10-03')).toBe(45);
  });
});

describe('targets (§B9.4)', () => {
  it('computes progress, or null without a target', () => {
    expect(targetProgress(200, 480)).toBeCloseTo(0.4167, 3);
    expect(targetProgress(200, null)).toBeNull();
    expect(targetProgress(200, 0)).toBeNull();
  });

  it('is behind pace below 75% of the expected time so far', () => {
    // Wednesday 2026-09-30: 3 days elapsed, target 7h → expected 3h, threshold 2h 15m.
    expect(isBehindPace(134, 420, '2026-09-30')).toBe(true);
    expect(isBehindPace(135, 420, '2026-09-30')).toBe(false);
    // Monday: 1 day elapsed → expected 1h.
    expect(isBehindPace(44, 420, '2026-09-28')).toBe(true);
    expect(isBehindPace(0, null, '2026-09-30')).toBe(false);
  });
});

describe('neglect (§B9.5)', () => {
  it('warns about tracks and subtasks, most neglected first, never topics', () => {
    const latest = latestDateByNode(nodes, [fact('abx', '2026-09-28'), fact('d', '2026-10-02')]);
    const warnings = neglectWarnings(nodes, latest, '2026-10-03', 3);
    expect(warnings).toEqual([
      // "ac" was never logged: counted from its creation date (2026-09-01).
      { nodeId: 'ac', days: 32, neverLogged: true },
      { nodeId: 'a', days: 5, neverLogged: false },
      { nodeId: 'ab', days: 5, neverLogged: false },
    ]);
  });

  it('uses the threshold inclusively and skips archived nodes and their children', () => {
    const latest = new Map([
      ['a', '2026-09-30'],
      ['ab', '2026-09-30'],
      ['ac', '2026-09-30'],
      ['d', '2026-10-01'],
    ]);
    expect(neglectWarnings(nodes, latest, '2026-10-03', 3).map((w) => w.nodeId)).toEqual([
      'a',
      'ab',
      'ac',
    ]);
    const archived = nodes.map((n) => (n.id === 'a' ? { ...n, archivedAt: 'x' } : n));
    expect(neglectWarnings(archived, latest, '2026-10-03', 3)).toEqual([]);
  });
});

describe('streaks (§B9.6)', () => {
  const days = new Set([
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
  ]);

  it('counts back from yesterday while today is not logged yet', () => {
    expect(currentStreak(days, '2026-10-03')).toBe(3);
  });

  it('includes today once it is logged', () => {
    expect(currentStreak(new Set([...days, '2026-10-03']), '2026-10-03')).toBe(4);
  });

  it('is 0 after a missed day', () => {
    expect(currentStreak(days, '2026-10-04')).toBe(0);
    expect(currentStreak(new Set(), '2026-10-04')).toBe(0);
  });

  it('finds the longest run anywhere in history', () => {
    expect(longestStreak(days)).toBe(3);
    expect(
      longestStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-02-01']),
    ).toBe(4);
    expect(longestStreak([])).toBe(0);
  });
});

describe('syllabus (§B9.7)', () => {
  it('counts done topics among visible topics', () => {
    const withDone = nodes.map((n) =>
      n.id === 'abx' ? { ...n, topicStatus: 'done' as const } : n,
    );
    expect(syllabus(withDone, 'a')).toEqual({ done: 1, total: 2 });
    expect(syllabusPercent(withDone, 'ab')).toBe(50);
    const archivedTopic = withDone.map((n) => (n.id === 'aby' ? { ...n, archivedAt: 'x' } : n));
    expect(syllabusPercent(archivedTopic, 'a')).toBe(100);
  });

  it('is null without topics', () => {
    expect(syllabusPercent(nodes, 'd')).toBeNull();
  });
});

describe('heatmap (HEAT-1, §B9.8)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [30, 1],
    [31, 2],
    [90, 2],
    [91, 3],
    [180, 3],
    [181, 4],
  ])('%i minutes is level %i', (minutes, level) => {
    expect(heatLevel(minutes)).toBe(level);
  });

  it('starts on a Monday about a year back and ends today', () => {
    // 2026-10-03 is a Saturday; 364 days earlier is Saturday 2025-10-04, whose Monday is 09-29.
    expect(heatmapRange('2026-10-03')).toEqual({ start: '2025-09-29', end: '2026-10-03' });
  });

  it('lays days out in Monday-to-Sunday columns, leaving future days empty', () => {
    const weeks = heatmapWeeks('2026-09-21', '2026-10-03');
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]).toBe('2026-09-21');
    expect(weeks[0]?.[6]).toBe('2026-09-27');
    expect(weeks[1]).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      null,
    ]);
  });
});
