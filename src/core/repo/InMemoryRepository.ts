import { conflict, notFound } from '../domain/errors';
import type {
  Clock,
  Deadline,
  Score,
  Session,
  SessionFact,
  Settings,
  Task,
  TaskCompletion,
  TreeNode,
} from '../domain/types';
import type {
  DeadlinePatch,
  NewCompletion,
  NewDeadline,
  NewNode,
  NewScore,
  NewSession,
  NewTask,
  NodePatch,
  Repository,
  ScorePatch,
  SeedData,
  SessionFilter,
  SessionPatch,
  SettingsPatch,
  TaskPatch,
} from './Repository';

// Repository for demo mode (in the browser) and service tests. It mirrors the database rules that
// services rely on; returned objects are copies so callers can't mutate stored state.

const byNewest = (a: Session, b: Session) =>
  b.studiedOn.localeCompare(a.studiedOn) || b.createdAt.localeCompare(a.createdAt);

export class InMemoryRepository implements Repository {
  private nodes: TreeNode[] = [];
  private sessions: Session[] = [];
  private tasks: Task[] = [];
  private completions: TaskCompletion[] = [];
  private scores: Score[] = [];
  private deadlines: Deadline[] = [];
  private settings: Settings = {
    studentName: '',
    neglectDays: 3,
    lastExportAt: null,
    lastMcpCallAt: null,
  };
  // Creation times must be strictly increasing so "newest first" is stable, even when the clock
  // is frozen in tests.
  private lastStamp = 0;

  // Completion ids are made by the store, like the database's default.
  private completionCount = 0;

  constructor(private readonly clock: Clock) {}

  private newCompletionId(): string {
    return `00000000-0000-4000-a000-${String(++this.completionCount).padStart(12, '0')}`;
  }

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
      this.sessions.some((s) => ids.has(s.nodeId)) ||
      this.tasks.some((t) => ids.has(t.nodeId)) ||
      this.scores.some((s) => ids.has(s.nodeId)) ||
      this.deadlines.some((d) => ids.has(d.nodeId));
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
      .slice(0, filter.limit)
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

  async listSessionFacts(): Promise<SessionFact[]> {
    return this.sessions.map(({ nodeId, studiedOn, minutes }) => ({ nodeId, studiedOn, minutes }));
  }

  async listDeadlines(): Promise<Deadline[]> {
    return [...this.deadlines]
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.createdAt.localeCompare(b.createdAt))
      .map((d) => ({ ...d }));
  }

  async insertDeadline(input: NewDeadline): Promise<Deadline> {
    this.findNode(input.nodeId);
    const deadline: Deadline = { ...input, createdAt: this.stamp() };
    this.deadlines.push(deadline);
    return { ...deadline };
  }

  async updateDeadline(id: string, patch: DeadlinePatch): Promise<Deadline> {
    const deadline = this.deadlines.find((d) => d.id === id);
    if (!deadline) throw notFound('deadline_not_found');
    if (patch.nodeId !== undefined) this.findNode(patch.nodeId);
    Object.assign(deadline, patch);
    return { ...deadline };
  }

  async deleteDeadline(id: string): Promise<void> {
    const index = this.deadlines.findIndex((d) => d.id === id);
    if (index === -1) throw notFound('deadline_not_found');
    this.deadlines.splice(index, 1);
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(patch: SettingsPatch): Promise<Settings> {
    Object.assign(this.settings, patch);
    return { ...this.settings };
  }

  async recordMcpCall(at: string): Promise<void> {
    this.settings.lastMcpCallAt = at;
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

  private findTask(id: string): Task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw notFound('task_not_found');
    return task;
  }

  async listTasks(): Promise<Task[]> {
    return this.tasks.map((task) => ({ ...task }));
  }

  async insertTask(input: NewTask): Promise<Task> {
    this.findNode(input.nodeId);
    if (input.parentTaskId !== null) this.findTask(input.parentTaskId);
    const now = this.stamp();
    const task: Task = { ...input, archivedAt: null, createdAt: now, updatedAt: now };
    this.tasks.push(task);
    return { ...task };
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const task = this.findTask(id);
    if (patch.nodeId !== undefined) this.findNode(patch.nodeId);
    Object.assign(task, patch, { updatedAt: this.stamp() });
    return { ...task };
  }

  async deleteTask(id: string): Promise<void> {
    this.findTask(id);
    const ids = new Set([id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of this.tasks) {
        if (t.parentTaskId !== null && ids.has(t.parentTaskId) && !ids.has(t.id)) {
          ids.add(t.id);
          grew = true;
        }
      }
    }
    const removed = new Set(this.completions.filter((c) => ids.has(c.taskId)).map((c) => c.id));
    // Like the foreign keys: completions cascade, linked scores are kept but unlinked.
    for (const score of this.scores) {
      if (score.taskCompletionId !== null && removed.has(score.taskCompletionId)) {
        score.taskCompletionId = null;
      }
    }
    this.completions = this.completions.filter((c) => !removed.has(c.id));
    this.tasks = this.tasks.filter((t) => !ids.has(t.id));
  }

  async listTaskCompletions(): Promise<TaskCompletion[]> {
    return this.completions.map((c) => ({ ...c }));
  }

  async completeTask(input: NewCompletion): Promise<TaskCompletion> {
    this.findTask(input.taskId);
    if (
      this.completions.some((c) => c.taskId === input.taskId && c.periodStart === input.periodStart)
    ) {
      throw conflict('already_completed');
    }
    if (input.score) this.findNode(input.score.nodeId);
    const completion: TaskCompletion = {
      id: this.newCompletionId(),
      taskId: input.taskId,
      periodStart: input.periodStart,
      completedAt: input.completedAt,
      note: input.note,
    };
    this.completions.push(completion);
    if (input.score) {
      this.scores.push({
        ...input.score,
        taskCompletionId: completion.id,
        createdAt: this.stamp(),
      });
    }
    return { ...completion };
  }

  async uncompleteTask(completionId: string): Promise<void> {
    if (!this.completions.some((c) => c.id === completionId)) {
      throw notFound('completion_not_found');
    }
    this.scores = this.scores.filter((s) => s.taskCompletionId !== completionId);
    this.completions = this.completions.filter((c) => c.id !== completionId);
  }

  async listScores(): Promise<Score[]> {
    return [...this.scores]
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt))
      .map((s) => ({ ...s }));
  }

  async insertScore(input: NewScore): Promise<Score> {
    this.findNode(input.nodeId);
    const score: Score = { ...input, taskCompletionId: null, createdAt: this.stamp() };
    this.scores.push(score);
    return { ...score };
  }

  async updateScore(id: string, patch: ScorePatch): Promise<Score> {
    const score = this.scores.find((s) => s.id === id);
    if (!score) throw notFound('score_not_found');
    if (patch.nodeId !== undefined) this.findNode(patch.nodeId);
    Object.assign(score, patch);
    return { ...score };
  }

  async deleteScore(id: string): Promise<void> {
    const index = this.scores.findIndex((s) => s.id === id);
    if (index === -1) throw notFound('score_not_found');
    this.scores.splice(index, 1);
  }
}
