import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { hiddenIds, nodePath } from './tree';

// MCP-5: Claude refers to nodes by id or by a path such as "Improvement Exams > Maths > Chapter 3"
// (case-insensitive, ">"-separated). The end of a path, or a unique partial name ("maths"), also
// works. Ambiguous or unknown references fail with up to 5 suggestions, so Claude can retry.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SUGGESTIONS = 5;

interface Candidate {
  node: TreeNode;
  /** Lower-cased names from the track down to the node. */
  segments: string[];
  label: string;
}

type Matcher = (candidate: string[], wanted: string[]) => boolean;

const endsWith =
  (same: (have: string, want: string) => boolean): Matcher =>
  (have, want) => {
    const offset = have.length - want.length;
    return offset >= 0 && want.every((segment, i) => same(have[offset + i] ?? '', segment));
  };

// Tried in order; the first tier with any match decides.
const TIERS: Matcher[] = [
  (have, want) => have.length === want.length && endsWith((a, b) => a === b)(have, want),
  endsWith((a, b) => a === b),
  endsWith((a, b) => a.includes(b)),
];

function describe(candidates: readonly Candidate[]): string {
  return candidates.map((c) => `"${c.label}" (id ${c.node.id})`).join('; ');
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function closest(candidates: readonly Candidate[], wanted: string[]): Candidate[] {
  const target = wanted.join(' > ');
  const last = wanted.at(-1) ?? '';
  const score = (c: Candidate) =>
    Math.min(
      levenshtein(c.segments.join(' > '), target),
      levenshtein(c.segments.at(-1) ?? '', last),
    );
  return [...candidates].sort((a, b) => score(a) - score(b)).slice(0, MAX_SUGGESTIONS);
}

/** Finds the node a reference points to, or throws a DomainError with suggestions. */
export function resolveNodeRef(nodes: readonly TreeNode[], ref: string): TreeNode {
  const trimmed = ref.trim();
  if (UUID_PATTERN.test(trimmed)) {
    const node = nodes.find((n) => n.id === trimmed.toLowerCase());
    if (node) return node;
  }

  const hidden = hiddenIds(nodes);
  const candidates: Candidate[] = nodes.map((node) => {
    const names = nodePath(nodes, node.id);
    return {
      node,
      segments: names.map((name) => name.toLowerCase()),
      label: names.join(' > ') + (hidden.has(node.id) ? ' [archived]' : ''),
    };
  });
  const wanted = trimmed
    .split('>')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  if (wanted.length > 0) {
    for (const matches of TIERS) {
      const found = candidates.filter((c) => matches(c.segments, wanted));
      // Archived nodes only win when nothing visible matches.
      const visible = found.filter((c) => !hidden.has(c.node.id));
      const pick = visible.length > 0 ? visible : found;
      if (pick.length === 1 && pick[0]) return pick[0].node;
      if (pick.length > 1) {
        throw new DomainError(
          'validation',
          'node_ambiguous',
          `"${trimmed}" matches more than one item: ${describe(pick.slice(0, MAX_SUGGESTIONS))}. ` +
            'Use a longer path or the id.',
        );
      }
    }
  }

  const suggestions = closest(
    candidates.filter((c) => !hidden.has(c.node.id)),
    wanted.length > 0 ? wanted : [trimmed.toLowerCase()],
  );
  throw new DomainError(
    'not_found',
    'node_not_found',
    `Nothing matches "${trimmed}".` +
      (suggestions.length > 0 ? ` Closest: ${describe(suggestions)}.` : ''),
  );
}
