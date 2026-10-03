import type { SessionFact, TreeNode } from '../domain/types';

// SPEC §B9.3: a session counts for its own node and for every ancestor.

/** Each node's id followed by its ancestors' ids. */
function ancestry(nodes: readonly TreeNode[]): Map<string, string[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chains = new Map<string, string[]>();
  for (const node of nodes) {
    const chain: string[] = [];
    for (let n: TreeNode | undefined = node; n; n = n.parentId ? byId.get(n.parentId) : undefined) {
      chain.push(n.id);
    }
    chains.set(node.id, chain);
  }
  return chains;
}

/** Rolled-up minutes per node, optionally within an inclusive date range. */
export function minutesByNode(
  nodes: readonly TreeNode[],
  facts: readonly SessionFact[],
  range: { from?: string; to?: string } = {},
): Map<string, number> {
  const chains = ancestry(nodes);
  const totals = new Map<string, number>();
  for (const fact of facts) {
    if (range.from !== undefined && fact.studiedOn < range.from) continue;
    if (range.to !== undefined && fact.studiedOn > range.to) continue;
    for (const id of chains.get(fact.nodeId) ?? []) {
      totals.set(id, (totals.get(id) ?? 0) + fact.minutes);
    }
  }
  return totals;
}

/** The latest session date in each node's subtree. */
export function latestDateByNode(
  nodes: readonly TreeNode[],
  facts: readonly SessionFact[],
): Map<string, string> {
  const chains = ancestry(nodes);
  const latest = new Map<string, string>();
  for (const fact of facts) {
    for (const id of chains.get(fact.nodeId) ?? []) {
      const current = latest.get(id);
      if (current === undefined || fact.studiedOn > current) latest.set(id, fact.studiedOn);
    }
  }
  return latest;
}

/** Total minutes per date. */
export function dailyTotals(facts: readonly SessionFact[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const fact of facts) {
    totals.set(fact.studiedOn, (totals.get(fact.studiedOn) ?? 0) + fact.minutes);
  }
  return totals;
}
