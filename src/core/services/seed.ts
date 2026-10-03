import type { IdGenerator } from '../domain/types';
import type { Repository, SeedData } from '../repo/Repository';

// SPEC §B4: the starting structure, written automatically on the first successful login when there
// are no nodes. The same definition seeds the demo's in-memory store. No personal data here.

export function buildSeed(newId: IdGenerator): SeedData {
  const german = newId();
  const exams = newId();
  const claude = newId();

  return {
    nodes: [
      { id: german, parentId: null, name: 'German Language', color: 'amber', sortOrder: 0 },
      { id: newId(), parentId: german, name: 'Self-study', color: null, sortOrder: 0 },
      { id: newId(), parentId: german, name: 'Class', color: null, sortOrder: 1 },
      { id: exams, parentId: null, name: 'Improvement Exams', color: 'blue', sortOrder: 1 },
      { id: newId(), parentId: exams, name: 'Maths', color: null, sortOrder: 0 },
      { id: newId(), parentId: exams, name: 'English', color: null, sortOrder: 1 },
      { id: claude, parentId: null, name: 'Claude Certification', color: 'violet', sortOrder: 2 },
    ],
    tasks: [
      {
        id: newId(),
        nodeId: german,
        title: 'Weekly recall / revision',
        recurrence: 'weekly',
        isScored: true,
        defaultMaxScore: 20,
        sortOrder: 0,
      },
    ],
  };
}

/** Seeds the starting structure if the store is empty. Safe to call on every login. */
export async function seedIfEmpty(repo: Repository, newId: IdGenerator): Promise<boolean> {
  return repo.seedIfEmpty(buildSeed(newId));
}
