import type { Clock, Settings, Task, TreeNode } from '../domain/types';
import type { Repository, SeedData } from './Repository';

// Repository for demo mode (in the browser) and service tests. It mirrors the database rules that
// services rely on; returned objects are copies so callers can't mutate stored state.

export class InMemoryRepository implements Repository {
  private nodes: TreeNode[] = [];
  private tasks: Task[] = [];
  private settings: Settings = {
    studentName: '',
    neglectDays: 3,
    lastExportAt: null,
    lastMcpCallAt: null,
  };

  constructor(private readonly clock: Clock) {}

  async listNodes(): Promise<TreeNode[]> {
    return this.nodes.map((node) => ({ ...node }));
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async seedIfEmpty(seed: SeedData): Promise<boolean> {
    if (this.nodes.length > 0) return false;
    const now = this.clock().toISOString();
    const depthById = new Map<string, TreeNode['depth']>();

    for (const node of seed.nodes) {
      const parentDepth = node.parentId === null ? 0 : depthById.get(node.parentId);
      if (parentDepth === undefined || parentDepth >= 3) {
        throw new Error(`Invalid seed node "${node.name}"`);
      }
      const depth = (parentDepth + 1) as TreeNode['depth'];
      depthById.set(node.id, depth);
      this.nodes.push({
        id: node.id,
        parentId: node.parentId,
        depth,
        name: node.name,
        color: node.color,
        sortOrder: node.sortOrder,
        weeklyTargetMinutes: null,
        topicStatus: depth === 3 ? 'not_started' : null,
        topicDoneAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const task of seed.tasks) {
      this.tasks.push({
        ...task,
        parentTaskId: null,
        description: null,
        dueOn: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return true;
  }

  /** For tests and demo data: the stored tasks. Replaced by a real query in M5. */
  listTasksForTesting(): Task[] {
    return this.tasks.map((task) => ({ ...task }));
  }
}
