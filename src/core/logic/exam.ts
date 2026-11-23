import type { ExamTarget, ExamView, MockCell, Score, TreeNode } from '../domain/types.js';
import { scorePercent } from './scores.js';
import { hiddenIds, sortSiblings, subtreeIds } from './tree.js';

// EXAM-4–6, SPEC §B9.16: modules, the per-module series, and the mock grid. Pure.

/** The column for scores on the exam's node itself, when it has modules below it. */
export const OVERALL_MODULE = 'overall';

type ExamDetail = NonNullable<ExamView['exam']>;

/** The exam node's visible direct children, or the node itself when it has none. */
export function examModules(
  nodes: readonly TreeNode[],
  examNodeId: string,
): { id: string; name: string }[] {
  const hidden = hiddenIds(nodes);
  const children = sortSiblings(
    nodes.filter((n) => n.parentId === examNodeId && !hidden.has(n.id)),
  );
  if (children.length > 0) return children.map((n) => ({ id: n.id, name: n.name }));
  const node = nodes.find((n) => n.id === examNodeId);
  return node ? [{ id: node.id, name: node.name }] : [];
}

/** Maps a score's node to its module column, `OVERALL_MODULE`, or null when it's outside. */
function moduleFinder(nodes: readonly TreeNode[], examNodeId: string, modules: { id: string }[]) {
  const moduleOfNode = new Map<string, string>();
  for (const module of modules) {
    for (const id of subtreeIds(nodes, module.id)) moduleOfNode.set(id, module.id);
  }
  const onlyItself = modules.length === 1 && modules[0]?.id === examNodeId;
  return (nodeId: string): string | null => {
    if (!onlyItself && nodeId === examNodeId) return OVERALL_MODULE;
    return moduleOfNode.get(nodeId) ?? null;
  };
}

const normalTitle = (title: string) => title.trim().toLowerCase();

/** Oldest first: by date, then by when it was recorded. */
const byDate = (a: Score, b: Score) =>
  a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt);

/**
 * §B9.16: the target for a mock row: the one whose label matches its title, otherwise the latest
 * one dated on or before the row's first date, otherwise none.
 */
export function rowTarget(
  targets: readonly ExamTarget[],
  title: string,
  firstDate: string,
): { label: string; minPercent: number } | null {
  const named = targets.find((t) => normalTitle(t.label) === normalTitle(title));
  const dated = [...targets]
    .filter((t) => t.targetOn <= firstDate)
    .sort((a, b) => b.targetOn.localeCompare(a.targetOn))[0];
  const target = named ?? dated;
  return target ? { label: target.label, minPercent: target.minPercent } : null;
}

/** A row's average across the modules with a score, to one decimal place. */
function average(cells: readonly (MockCell | null)[]): number | null {
  const percents = cells.flatMap((c) => (c ? [c.percent] : []));
  if (percents.length === 0) return null;
  return Math.round((percents.reduce((sum, p) => sum + p, 0) / percents.length) * 10) / 10;
}

/** Modules, series, and mock rows for an exam whose deadline is on `examNodeId`. */
export function examDetail(
  nodes: readonly TreeNode[],
  examNodeId: string,
  scores: readonly Score[],
  targets: readonly ExamTarget[],
): Pick<ExamDetail, 'modules' | 'series' | 'mocks'> {
  const baseModules = examModules(nodes, examNodeId);
  const moduleFor = moduleFinder(nodes, examNodeId, baseModules);
  const placed = scores
    .flatMap((score) => {
      const moduleId = moduleFor(score.nodeId);
      return moduleId === null ? [] : [{ score, moduleId }];
    })
    .sort((a, b) => byDate(a.score, b.score));
  const modules = placed.some((p) => p.moduleId === OVERALL_MODULE)
    ? [...baseModules, { id: OVERALL_MODULE, name: 'Overall' }]
    : baseModules;

  const series = modules.map((module) => ({
    moduleId: module.id,
    points: placed
      .filter((p) => p.moduleId === module.id)
      .map(({ score }) => ({
        date: score.takenOn,
        percent: scorePercent(score.score, score.maxScore),
        title: score.title,
      })),
  }));

  // Rows: distinct mock test titles, by their earliest date; a cell is the latest such score.
  const rows = new Map<string, { title: string; firstDate: string; latest: Map<string, Score> }>();
  for (const { score, moduleId } of placed) {
    if (score.kind !== 'mock_test') continue;
    const key = normalTitle(score.title);
    const row = rows.get(key) ?? {
      title: score.title.trim(),
      firstDate: score.takenOn,
      latest: new Map(),
    };
    row.latest.set(moduleId, score); // `placed` is oldest first, so the last one wins
    rows.set(key, row);
  }
  const mocks = [...rows.values()]
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate))
    .map((row) => {
      const cells: Record<string, MockCell | null> = {};
      for (const module of modules) {
        const score = row.latest.get(module.id);
        cells[module.id] = score
          ? {
              scoreId: score.id,
              score: score.score,
              maxScore: score.maxScore,
              percent: scorePercent(score.score, score.maxScore),
              takenOn: score.takenOn,
            }
          : null;
      }
      return {
        title: row.title,
        firstDate: row.firstDate,
        cells,
        average: average(Object.values(cells)),
        target: rowTarget(targets, row.title, row.firstDate),
      };
    });

  return { modules, series, mocks };
}

/** EXAM-4: the target line steps up to each target's percentage on its date. */
export function targetSteps(
  targets: readonly ExamTarget[],
): { date: string; minPercent: number }[] {
  return [...targets]
    .sort((a, b) => a.targetOn.localeCompare(b.targetOn))
    .map((t) => ({ date: t.targetOn, minPercent: t.minPercent }));
}
