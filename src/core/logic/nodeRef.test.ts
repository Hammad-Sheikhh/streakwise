import { describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { resolveDateRef } from './dateRef';
import { resolveNodeRef } from './nodeRef';

// A node's depth is the length of its id here: "A" is a track, "m" a subtask, "mc" a topic.
function node(id: string, parentId: string | null, name: string, archived = false): TreeNode {
  const depth = parentId === null ? 1 : id.length === 1 ? 2 : 3;
  return {
    id,
    parentId,
    depth,
    name,
    color: null,
    sortOrder: 0,
    weeklyTargetMinutes: null,
    topicStatus: depth === 3 ? 'not_started' : null,
    topicDoneAt: null,
    archivedAt: archived ? '2026-09-01T00:00:00.000Z' : null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const UUID = '0b0e4c1e-1111-4222-8333-444455556666';
const nodes: TreeNode[] = [
  node('A', null, 'School Subjects'),
  node('m', 'A', 'Maths'),
  node('mc', 'm', 'Chapter 3'),
  node('e', 'A', 'English'),
  node('ec', 'e', 'Chapter 3'),
  node('B', null, 'Exam Prep'),
  node('s', 'B', 'Flashcards'),
  node('c', 'B', 'Practice'),
  node('o', 'B', 'Old Maths Notes', true),
  { ...node('x', 'B', 'By id'), id: UUID },
];

function failure(ref: string): DomainError {
  try {
    resolveNodeRef(nodes, ref);
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error(`"${ref}" resolved`);
}

describe('resolveNodeRef (MCP-5)', () => {
  it('accepts an id, in any case', () => {
    expect(resolveNodeRef(nodes, UUID.toUpperCase()).name).toBe('By id');
  });

  it('accepts a full path, case-insensitively, with loose spacing', () => {
    expect(resolveNodeRef(nodes, 'school subjects>MATHS >  chapter 3').id).toBe('mc');
  });

  it('accepts the end of a path', () => {
    expect(resolveNodeRef(nodes, 'English > Chapter 3').id).toBe('ec');
  });

  it('accepts a unique exact name, preferring it over partial matches', () => {
    // "maths" is also part of the archived "Old Maths Notes", but the exact name wins.
    expect(resolveNodeRef(nodes, 'maths').id).toBe('m');
  });

  it('accepts a unique partial name', () => {
    expect(resolveNodeRef(nodes, 'flash').id).toBe('s');
    expect(resolveNodeRef(nodes, 'exam').id).toBe('B');
  });

  it('finds archived nodes only when nothing visible matches', () => {
    expect(resolveNodeRef(nodes, 'old maths').id).toBe('o');
  });

  it('lists the candidates when a reference is ambiguous', () => {
    const error = failure('chapter 3');
    expect(error.code).toBe('node_ambiguous');
    expect(error.message).toContain('"School Subjects > Maths > Chapter 3" (id mc)');
    expect(error.message).toContain('"School Subjects > English > Chapter 3" (id ec)');
  });

  it('suggests up to 5 close matches for an unknown reference', () => {
    const error = failure('Engish');
    expect(error.kind).toBe('not_found');
    expect(error.message).toMatch(
      /^Nothing matches "Engish"\. Closest: "School Subjects > English"/,
    );
    expect(error.message.match(/\(id /g)).toHaveLength(5);
    expect(error.message).not.toContain('Old Maths Notes');
  });

  it('treats an unknown id as unknown', () => {
    expect(failure('99999999-1111-4222-8333-444455556666').code).toBe('node_not_found');
  });
});

describe('resolveDateRef (MCP-6)', () => {
  it('understands today, yesterday, and dates', () => {
    expect(resolveDateRef('today', '2026-10-01')).toBe('2026-10-01');
    expect(resolveDateRef(' Yesterday ', '2026-10-01')).toBe('2026-09-30');
    expect(resolveDateRef('2026-02-28', '2026-10-01')).toBe('2026-02-28');
  });

  it('rejects anything else', () => {
    for (const ref of ['tomorrow', '2026-02-30', '03/10/2026', '']) {
      expect(() => resolveDateRef(ref, '2026-10-01')).toThrow(/today", "yesterday", or YYYY-MM-DD/);
    }
  });
});
