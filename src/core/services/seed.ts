import type { IdGenerator } from '../domain/types';
import type { Repository, SeedData } from '../repo/Repository';

// SPEC §B4: the starting structure, written automatically on the first successful login when there
// are no nodes. The same definition seeds the demo's in-memory store. No personal data here.

export function buildSeed(newId: IdGenerator): SeedData {
  const examPrep = newId();
  const subjects = newId();
  const course = newId();

  return {
    nodes: [
      { id: examPrep, parentId: null, name: 'Exam Prep', color: 'amber', sortOrder: 0 },
      { id: newId(), parentId: examPrep, name: 'Flashcards', color: null, sortOrder: 0 },
      { id: newId(), parentId: examPrep, name: 'Practice', color: null, sortOrder: 1 },
      { id: subjects, parentId: null, name: 'School Subjects', color: 'blue', sortOrder: 1 },
      { id: newId(), parentId: subjects, name: 'Maths', color: null, sortOrder: 0 },
      { id: newId(), parentId: subjects, name: 'English', color: null, sortOrder: 1 },
      { id: course, parentId: null, name: 'Online Course', color: 'violet', sortOrder: 2 },
    ],
    tasks: [
      {
        id: newId(),
        nodeId: examPrep,
        title: 'Weekly self-test',
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
