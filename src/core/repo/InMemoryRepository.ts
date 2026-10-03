import { conflict, notFound } from '../domain/errors';
import type { Clock, Session, Settings, Task, TreeNode } from '../domain/types';
import type {
  NewNode,
  NewSession,
  NodePatch,
  Repository,
  SeedData,
  SessionFilter,
  SessionPatch,
  SettingsPatch,
} from './Repository';

// Repository for demo mode (in the browser) and service tests. It mirrors the database rules that
// services rely on; returned objects are copies so callers can't mutate stored state.

const byNewest = (a: Session, b: Session) =>
  b.studiedOn.localeCompare(a.studiedOn) || b.createdAt.localeCompare(a.createdAt);

export class InMemoryRepository implements Repository {
  private nodes: TreeNode[] = [];
  private sessions: Session[] = [];
  private tasks: Task[] = [];
  private settings: Settings = {
    studentName: '',
    neglectDays: 3,
    lastExportAt: null,
    lastMcpCallAt: null,
  };
  // Creation times must be strictly increasing so "newest first" is stable, even when the clock
  // is frozen in tests.
  private lastStamp = 0;

  constructor(private readonly clock: Clock) {}

  private stamp(): string {
    this.lastStamp = Math.max(this.clock().getTime(), this.lastStamp + 1);
    return new Date(this.lastStamp).toISOString();
  }

  private findNode(id: string): TreeNode {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw notFound('node_not_found');
    return node;
  }

  private assertUniqueName(parentId: string | null, name: string, exceptId?: string): void {
    const clash = this.nodes.some(
      (n) =>
        n.parentId === parentId && n.id !== exceptId && n.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw conflict('duplicate');
  }

  async listNodes(): Promise<TreeNode[]> {
    return this.nodes.map((node) => ({ ...node }));
  }

  async insertNode(input: NewNode): Promise<TreeNode> {
    const parentDepth = input.parentId === null ? 0 : this.findNode(input.parentId).depth;
    if (parentDepth >= 3) throw conflict('max_depth');
    this.assertUniqueName(input.parentId, input.name);
    const now = this.stamp();
    const node: TreeNode = {
      ...input,
      depth: (parentDepth + 1) as TreeNode['depth'],
      weeklyTargetMinutes: null,
      topicDoneAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.push(node);
    return { ...node };
  }

  async updateNode(id: string, patch: NodePatch): Promise<TreeNode> {
    const node = this.findNode(id);
    if (patch.name !== undefined) this.assertUniqueName(node.parentId, patch.name, id);
    Object.assign(node, patch, { updatedAt: this.stamp() });
    return { ...node };
  }

  async deleteNodeTree(id: string): Promise<void> {
    this.findNode(id);
    const ids = new Set([id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const n of this.nodes) {
        if (n.parentId !== null && ids.has(n.parentId) && !ids.has(n.id)) {
          ids.add(n.id);
          grew = true;
        }
      }
    }
    const inUse =
      this.sessions.some((s) => ids.has(s.nodeId)) || this.tasks.some((t) => ids.has(t.nodeId));
    if (inUse) throw conflict('node_in_use');
    this.nodes = this.nodes.filter((n) => !ids.has(n.id));
  }

  async getSession(id: string): Promise<Session | null> {
    const session = this.sessions.find((s) => s.id === id);
    return session ? { ...session } : null;
  }

  async insertSession(input: NewSession): Promise<Session> {
    this.findNode(input.nodeId);
    const now = this.stamp();
    const session: Session = { ...input, createdAt: now, updatedAt: now };
    this.sessions.push(session);
    return { ...session };
  }

  async updateSession(id: string, patch: SessionPatch): Promise<Session> {
    const session = this.sessions.find((s) => s.id === id);
    if (!session) throw notFound('session_not_found');
    if (patch.nodeId !== undefined) this.findNode(patch.nodeId);
    Object.assign(session, patch, { updatedAt: this.stamp() });
    return { ...session };
  }

  async deleteSession(id: string): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) throw notFound('session_not_found');
    this.sessions.splice(index, 1);
  }

  private matching(filter: SessionFilter): Session[] {
    const nodeIds = filter.nodeIds && new Set(filter.nodeIds);
    return this.sessions.filter(
      (s) =>
        (filter.from === undefined || s.studiedOn >= filter.from) &&
        (filter.to === undefined || s.studiedOn <= filter.to) &&
        (nodeIds === undefined || nodeIds.has(s.nodeId)) &&
        (filter.source === undefined || s.source === filter.source),
    );
  }

  async listSessions(filter: SessionFilter): Promise<Session[]> {
    return this.matching(filter)
      .sort(byNewest)
      .map((s) => ({ ...s }));
  }

  async latestSessionDate(filter: SessionFilter): Promise<string | null> {
    return this.matching(filter).sort(byNewest)[0]?.studiedOn ?? null;
  }

  async listRecentSessions(limit: number): Promise<Session[]> {
    return [...this.sessions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(patch: SettingsPatch): Promise<Settings> {
    Object.assign(this.settings, patch);
    return { ...this.settings };
  }

  async seedIfEmpty(seed: SeedData): Promise<boolean> {
    if (this.nodes.length > 0) return false;
    for (const node of seed.nodes) {
      await this.insertNode({ ...node, topicStatus: null });
    }
    const now = this.stamp();
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
