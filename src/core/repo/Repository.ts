import type { Settings, TaskRecurrence, TrackColor, TreeNode } from '../domain/types';

// Storage used by the core services. SupabaseRepository (server) and InMemoryRepository (demo mode
// and tests) implement it. Later milestones add methods for sessions, tasks, scores, and so on.

export interface SeedNode {
  id: string;
  parentId: string | null;
  name: string;
  color: TrackColor | null;
  sortOrder: number;
}

export interface SeedTask {
  id: string;
  nodeId: string;
  title: string;
  recurrence: TaskRecurrence;
  isScored: boolean;
  defaultMaxScore: number | null;
  sortOrder: number;
}

/** Nodes are listed parents first. */
export interface SeedData {
  nodes: SeedNode[];
  tasks: SeedTask[];
}

export interface Repository {
  listNodes(): Promise<TreeNode[]>;
  getSettings(): Promise<Settings>;
  /** Atomically writes the seed if there are no nodes yet. Returns whether it seeded. */
  seedIfEmpty(seed: SeedData): Promise<boolean>;
}
