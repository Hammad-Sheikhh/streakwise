import type {
  ChangeAction,
  ChangeEntity,
  ChangeEntry,
  Clock,
  Deadline,
  ExamTarget,
  IdGenerator,
  Mistake,
  RestoreData,
  Score,
  Session,
  SessionFact,
  SessionSource,
  Settings,
  SharedReportLink,
  Task,
  TaskCompletion,
  TreeNode,
} from '../domain/types.js';
import { localDate } from '../logic/dates.js';
import { formatDay } from '../logic/labels.js';
import { formatDuration } from '../logic/duration.js';
import { nodePath, subtreeIds } from '../logic/tree.js';
import type {
  DeadlinePatch,
  ExamTargetPatch,
  MistakePatch,
  NewChange,
  NewCompletion,
  NewDeadline,
  NewExamTarget,
  NewMistake,
  NewNode,
  NewScore,
  NewSession,
  NewSharedReport,
  NewTask,
  NodePatch,
  Repository,
  ScorePatch,
  SeedData,
  SessionFilter,
  SessionPatch,
  SettingsPatch,
  TaskPatch,
  TaskTreeSnapshot,
} from './Repository.js';

// UNDO-3: every change to sessions, scores, tasks, completions, mistakes, nodes, and deadlines is
// recorded here, once, for the app, demo mode, and Claude alike (D28). Writes go to the wrapped
// store first; the entry is written after the write succeeds. If recording fails the write still
// stands, and `onRecordError` is told (without any data).
//
// Reads, settings, shares, and the change log itself pass straight through. Undo works on the
// wrapped store (`withoutRecording`), so undoing is never recorded (UNDO-5: no redo).

export interface RecordingOptions {
  /** Who is making the changes: the app (or demo) or Claude through MCP. */
  source: SessionSource;
  newId: IdGenerator;
  onRecordError?: (error: unknown) => void;
  /**
   * UNDO-7: after a change is recorded, entries older than the returned time are removed. Return
   * null when no clean-up is due (see `dailyPrune`).
   */
  pruneBefore?: () => string | null;
}

/** UNDO-7: entries are kept this long. */
export const CHANGE_KEEP_DAYS = 30;

/**
 * UNDO-7: a clean-up at most once per Karachi day for `key` (a user), remembered in `state`, which
 * lives as long as the process (a warm function instance, or the demo).
 */
export function dailyPrune(clock: Clock, key: string, state: Map<string, string>) {
  return (): string | null => {
    const now = clock();
    const day = localDate(now);
    if (state.get(key) === day) return null;
    state.set(key, day);
    return new Date(now.getTime() - CHANGE_KEEP_DAYS * 86_400_000).toISOString();
  };
}

/** What a completion entry stores: the completion, its task's title, and the score it made. */
export interface CompletionSnapshot {
  completion: TaskCompletion;
  score: Score | null;
  taskTitle: string;
}

/** What a node delete stores: the removed subtree, parents first. */
export interface NodeTreeSnapshot {
  nodes: TreeNode[];
}

/** What a deadline delete stores: the deadline and the exam targets that went with it. */
export type DeadlineSnapshot = Deadline & { examTargets: ExamTarget[] };

/** The change log's summary column holds at most this many characters. */
export const MAX_SUMMARY_LENGTH = 200;

function clip(text: string): string {
  return text.length <= MAX_SUMMARY_LENGTH ? text : `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…`;
}

/** Shortens free text (titles, mistakes) inside a summary. */
function short(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Fields that are bookkeeping, not part of a change the owner made. */
const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt']);

/** The fields whose values differ between two snapshots of the same item. */
export function changedFields(before: object, after: object): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return [...keys].filter(
    (key) => !IGNORED_FIELDS.has(key) && JSON.stringify(a[key]) !== JSON.stringify(b[key]),
  );
}

/** archive/unarchive when only the archived time changed; otherwise update. */
function archiveAction(before: { archivedAt: string | null }, fields: string[]): ChangeAction {
  if (fields.length === 1 && fields[0] === 'archivedAt') {
    return before.archivedAt === null ? 'archive' : 'unarchive';
  }
  return 'update';
}

export class RecordingRepository implements Repository {
  constructor(
    readonly inner: Repository,
    private readonly options: RecordingOptions,
  ) {}

  private async record(change: Omit<NewChange, 'id' | 'source'>): Promise<void> {
    try {
      await this.inner.insertChange({
        id: this.options.newId(),
        source: this.options.source,
        ...change,
        summary: clip(change.summary),
      });
      const cutoff = this.options.pruneBefore?.();
      if (cutoff) await this.inner.deleteChangesBefore(cutoff);
    } catch (error) {
      this.options.onRecordError?.(error);
    }
  }

  private async entry(
    entity: ChangeEntity,
    entityId: string,
    action: ChangeAction,
    summary: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.record({ entity, entityId, action, summary, before, after });
  }

  private async pathOf(nodeId: string | null): Promise<string> {
    if (nodeId === null) return 'Other';
    return nodePath(await this.inner.listNodes(), nodeId).join(' > ');
  }

  // ----- nodes

  listNodes(): Promise<TreeNode[]> {
    return this.inner.listNodes();
  }

  async insertNode(node: NewNode): Promise<TreeNode> {
    const created = await this.inner.insertNode(node);
    const kind = ['track', 'subtask', 'topic'][created.depth - 1] ?? 'item';
    await this.entry(
      'node',
      created.id,
      'create',
      `Added ${kind} · ${await this.pathOf(created.id)}`,
      null,
      created,
    );
    return created;
  }

  async updateNode(id: string, patch: NodePatch): Promise<TreeNode> {
    const before = (await this.inner.listNodes()).find((n) => n.id === id);
    const after = await this.inner.updateNode(id, patch);
    if (!before) return after;
    const fields = changedFields(before, after);
    // Reordering (TREE-6) isn't something to undo on its own.
    if (fields.length === 0 || fields.every((f) => f === 'sortOrder')) return after;
    const action = archiveAction(before, fields);
    const path = await this.pathOf(id);
    let summary = `Edited ${path}`;
    if (action === 'archive') summary = `Archived ${path}`;
    else if (action === 'unarchive') summary = `Restored ${path}`;
    else if (fields.includes('name')) summary = `Renamed ${before.name} → ${after.name}`;
    else if (fields.includes('topicStatus')) {
      summary = `${path} → ${(after.topicStatus ?? '').replace('_', ' ')}`;
    } else if (fields.includes('weeklyTargetMinutes')) {
      const target = after.weeklyTargetMinutes;
      summary = `Weekly target · ${path} · ${target ? formatDuration(target) : 'none'}`;
    }
    await this.entry('node', id, action, summary, before, after);
    return after;
  }

  async deleteNodeTree(id: string): Promise<void> {
    const nodes = await this.inner.listNodes();
    const ids = subtreeIds(nodes, id);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const removed = ids.flatMap((nodeId) => byId.get(nodeId) ?? []);
    const path = nodePath(nodes, id).join(' > ');
    await this.inner.deleteNodeTree(id);
    const snapshot: NodeTreeSnapshot = { nodes: removed };
    await this.entry('node', id, 'delete', `Deleted ${path}`, snapshot, null);
  }

  restoreNodes(nodes: TreeNode[]): Promise<void> {
    return this.inner.restoreNodes(nodes);
  }

  // ----- sessions

  getSession(id: string): Promise<Session | null> {
    return this.inner.getSession(id);
  }

  private async sessionSummary(verb: string, session: Session): Promise<string> {
    return `${verb} ${formatDuration(session.minutes)} · ${await this.pathOf(session.nodeId)}`;
  }

  async insertSession(session: NewSession): Promise<Session> {
    const created = await this.inner.insertSession(session);
    const summary = await this.sessionSummary('Logged', created);
    await this.entry('session', created.id, 'create', summary, null, created);
    return created;
  }

  async insertSessions(sessions: NewSession[]): Promise<Session[]> {
    const created = await this.inner.insertSessions(sessions);
    for (const session of created) {
      const summary = await this.sessionSummary('Logged', session);
      await this.entry('session', session.id, 'create', summary, null, session);
    }
    return created;
  }

  async updateSession(id: string, patch: SessionPatch): Promise<Session> {
    const before = await this.inner.getSession(id);
    const after = await this.inner.updateSession(id, patch);
    if (before && changedFields(before, after).length > 0) {
      const summary = await this.sessionSummary('Edited session ·', after);
      await this.entry('session', id, 'update', summary, before, after);
    }
    return after;
  }

  async deleteSession(id: string): Promise<void> {
    const before = await this.inner.getSession(id);
    await this.inner.deleteSession(id);
    if (before) {
      const summary = await this.sessionSummary('Deleted session ·', before);
      await this.entry('session', id, 'delete', summary, before, null);
    }
  }

  listSessions(filter: SessionFilter): Promise<Session[]> {
    return this.inner.listSessions(filter);
  }

  latestSessionDate(filter: SessionFilter): Promise<string | null> {
    return this.inner.latestSessionDate(filter);
  }

  listRecentSessions(limit: number): Promise<Session[]> {
    return this.inner.listRecentSessions(limit);
  }

  listSessionFacts(): Promise<SessionFact[]> {
    return this.inner.listSessionFacts();
  }

  listAllSessions(): Promise<Session[]> {
    return this.inner.listAllSessions();
  }

  // ----- deadlines

  listDeadlines(): Promise<Deadline[]> {
    return this.inner.listDeadlines();
  }

  private deadlineSummary(verb: string, deadline: Deadline): string {
    return `${verb} ${deadline.isExam ? 'exam' : 'deadline'} · ${short(deadline.title)} · ${formatDay(deadline.dueOn)}`;
  }

  async insertDeadline(deadline: NewDeadline): Promise<Deadline> {
    const created = await this.inner.insertDeadline(deadline);
    const summary = this.deadlineSummary('Added', created);
    await this.entry('deadline', created.id, 'create', summary, null, created);
    return created;
  }

  async updateDeadline(id: string, patch: DeadlinePatch): Promise<Deadline> {
    const before = (await this.inner.listDeadlines()).find((d) => d.id === id);
    const after = await this.inner.updateDeadline(id, patch);
    if (before && changedFields(before, after).length > 0) {
      const summary = this.deadlineSummary('Edited', after);
      await this.entry('deadline', id, 'update', summary, before, after);
    }
    return after;
  }

  async deleteDeadline(id: string): Promise<void> {
    const [deadlines, targets] = await Promise.all([
      this.inner.listDeadlines(),
      this.inner.listExamTargets(),
    ]);
    const before = deadlines.find((d) => d.id === id);
    await this.inner.deleteDeadline(id);
    if (before) {
      const snapshot: DeadlineSnapshot = {
        ...before,
        examTargets: targets.filter((t) => t.deadlineId === id),
      };
      const summary = this.deadlineSummary('Deleted', before);
      await this.entry('deadline', id, 'delete', summary, snapshot, null);
    }
  }

  listExamTargets(): Promise<ExamTarget[]> {
    return this.inner.listExamTargets();
  }

  private targetSummary(verb: string, target: ExamTarget): string {
    return `${verb} target · ${short(target.label)} · ${target.minPercent}% by ${formatDay(target.targetOn)}`;
  }

  async insertExamTarget(target: NewExamTarget): Promise<ExamTarget> {
    const created = await this.inner.insertExamTarget(target);
    const summary = this.targetSummary('Added', created);
    await this.entry('exam_target', created.id, 'create', summary, null, created);
    return created;
  }

  async updateExamTarget(id: string, patch: ExamTargetPatch): Promise<ExamTarget> {
    const before = (await this.inner.listExamTargets()).find((t) => t.id === id);
    const after = await this.inner.updateExamTarget(id, patch);
    if (before && changedFields(before, after).length > 0) {
      const summary = this.targetSummary('Edited', after);
      await this.entry('exam_target', id, 'update', summary, before, after);
    }
    return after;
  }

  async deleteExamTarget(id: string): Promise<void> {
    const before = (await this.inner.listExamTargets()).find((t) => t.id === id);
    await this.inner.deleteExamTarget(id);
    if (before) {
      const summary = this.targetSummary('Deleted', before);
      await this.entry('exam_target', id, 'delete', summary, before, null);
    }
  }

  // ----- tasks

  listTasks(): Promise<Task[]> {
    return this.inner.listTasks();
  }

  async insertTask(task: NewTask): Promise<Task> {
    const created = await this.inner.insertTask(task);
    const summary = `Added task · ${short(created.title)}`;
    await this.entry('task', created.id, 'create', summary, null, created);
    return created;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const before = (await this.inner.listTasks()).find((t) => t.id === id);
    const after = await this.inner.updateTask(id, patch);
    if (!before) return after;
    const fields = changedFields(before, after);
    if (fields.length === 0 || fields.every((f) => f === 'sortOrder')) return after;
    const action = archiveAction(before, fields);
    const verb = action === 'archive' ? 'Archived' : action === 'unarchive' ? 'Restored' : 'Edited';
    await this.entry('task', id, action, `${verb} task · ${short(after.title)}`, before, after);
    return after;
  }

  async deleteTask(id: string): Promise<void> {
    const [tasks, completions, scores] = await Promise.all([
      this.inner.listTasks(),
      this.inner.listTaskCompletions(),
      this.inner.listScores(),
    ]);
    const snapshot = taskTreeSnapshot(tasks, completions, scores, id);
    await this.inner.deleteTask(id);
    const [root] = snapshot.tasks;
    if (!root) return;
    const subtasks = snapshot.tasks.length - 1;
    const summary =
      `Deleted task · ${short(root.title)}` +
      (subtasks > 0 ? ` and ${subtasks} sub-task${subtasks === 1 ? '' : 's'}` : '');
    await this.entry('task', id, 'delete', summary, snapshot, null);
  }

  restoreTaskTree(snapshot: TaskTreeSnapshot): Promise<void> {
    return this.inner.restoreTaskTree(snapshot);
  }

  listTaskCompletions(): Promise<TaskCompletion[]> {
    return this.inner.listTaskCompletions();
  }

  async completeTask(input: NewCompletion): Promise<TaskCompletion> {
    const completion = await this.inner.completeTask(input);
    const [tasks, scores] = await Promise.all([this.inner.listTasks(), this.inner.listScores()]);
    const taskTitle = tasks.find((t) => t.id === input.taskId)?.title ?? 'Task';
    const score = scores.find((s) => s.taskCompletionId === completion.id) ?? null;
    const snapshot: CompletionSnapshot = { completion, score, taskTitle };
    const summary =
      `Completed · ${short(taskTitle)}` +
      (score ? ` · ${score.score}/${score.maxScore}` : '') +
      ` · ${formatDay(completion.completedOn)}`;
    await this.entry('completion', completion.id, 'complete', summary, null, snapshot);
    return completion;
  }

  async uncompleteTask(completionId: string): Promise<void> {
    const [tasks, completions, scores] = await Promise.all([
      this.inner.listTasks(),
      this.inner.listTaskCompletions(),
      this.inner.listScores(),
    ]);
    const completion = completions.find((c) => c.id === completionId);
    await this.inner.uncompleteTask(completionId);
    if (!completion) return;
    const taskTitle = tasks.find((t) => t.id === completion.taskId)?.title ?? 'Task';
    const score = scores.find((s) => s.taskCompletionId === completionId) ?? null;
    const snapshot: CompletionSnapshot = { completion, score, taskTitle };
    const summary = `Unticked · ${short(taskTitle)} · ${formatDay(completion.completedOn)}`;
    await this.entry('completion', completionId, 'uncomplete', summary, snapshot, null);
  }

  // ----- scores

  listScores(): Promise<Score[]> {
    return this.inner.listScores();
  }

  private scoreSummary(verb: string, score: Score): string {
    return `${verb} ${score.score}/${score.maxScore} · ${short(score.title)}`;
  }

  async insertScore(score: NewScore): Promise<Score> {
    const created = await this.inner.insertScore(score);
    const summary = `${this.scoreSummary('Added score', created)} · ${await this.pathOf(created.nodeId)}`;
    await this.entry('score', created.id, 'create', summary, null, created);
    return created;
  }

  async updateScore(id: string, patch: ScorePatch): Promise<Score> {
    const before = (await this.inner.listScores()).find((s) => s.id === id);
    const after = await this.inner.updateScore(id, patch);
    if (before && changedFields(before, after).length > 0) {
      await this.entry(
        'score',
        id,
        'update',
        this.scoreSummary('Edited score', after),
        before,
        after,
      );
    }
    return after;
  }

  async deleteScore(id: string): Promise<void> {
    const before = (await this.inner.listScores()).find((s) => s.id === id);
    await this.inner.deleteScore(id);
    if (before) {
      await this.entry(
        'score',
        id,
        'delete',
        this.scoreSummary('Deleted score', before),
        before,
        null,
      );
    }
  }

  // ----- mistakes

  listMistakes(): Promise<Mistake[]> {
    return this.inner.listMistakes();
  }

  async insertMistake(mistake: NewMistake): Promise<Mistake> {
    const created = await this.inner.insertMistake(mistake);
    const summary = `Added mistake · ${await this.pathOf(created.nodeId)} · ${short(created.text, 40)}`;
    await this.entry('mistake', created.id, 'create', summary, null, created);
    return created;
  }

  async updateMistake(id: string, patch: MistakePatch): Promise<Mistake> {
    const before = (await this.inner.listMistakes()).find((m) => m.id === id);
    const after = await this.inner.updateMistake(id, patch);
    if (!before) return after;
    const fields = changedFields(before, after);
    if (fields.length === 0) return after;
    const review = fields.includes('reviewCount');
    const path = await this.pathOf(after.nodeId);
    const summary = review
      ? `Reviewed mistake · ${after.lastResult ?? ''} · ${path}` +
        (after.status === 'learned' ? ' · learned' : '')
      : `Edited mistake · ${path} · ${short(after.text, 40)}`;
    await this.entry('mistake', id, review ? 'review' : 'update', summary, before, after);
    return after;
  }

  async deleteMistake(id: string): Promise<void> {
    const before = (await this.inner.listMistakes()).find((m) => m.id === id);
    await this.inner.deleteMistake(id);
    if (before) {
      const summary = `Deleted mistake · ${await this.pathOf(before.nodeId)} · ${short(before.text, 40)}`;
      await this.entry('mistake', id, 'delete', summary, before, null);
    }
  }

  // ----- the change log itself, settings, shares, seed: passed through, never recorded

  insertChange(change: NewChange): Promise<ChangeEntry> {
    return this.inner.insertChange(change);
  }

  listChanges(filter: { since: string; limit: number }): Promise<ChangeEntry[]> {
    return this.inner.listChanges(filter);
  }

  getChange(id: string): Promise<ChangeEntry | null> {
    return this.inner.getChange(id);
  }

  laterChanges(id: string): Promise<ChangeEntry[]> {
    return this.inner.laterChanges(id);
  }

  markChangeUndone(id: string, at: string): Promise<ChangeEntry> {
    return this.inner.markChangeUndone(id, at);
  }

  deleteChangesBefore(at: string): Promise<void> {
    return this.inner.deleteChangesBefore(at);
  }

  getSettings(): Promise<Settings> {
    return this.inner.getSettings();
  }

  updateSettings(patch: SettingsPatch): Promise<Settings> {
    return this.inner.updateSettings(patch);
  }

  recordMcpCall(at: string): Promise<void> {
    return this.inner.recordMcpCall(at);
  }

  recordExport(at: string): Promise<void> {
    return this.inner.recordExport(at);
  }

  insertSharedReport(report: NewSharedReport): Promise<SharedReportLink> {
    return this.inner.insertSharedReport(report);
  }

  listSharedReports(): Promise<SharedReportLink[]> {
    return this.inner.listSharedReports();
  }

  revokeSharedReport(id: string, at: string): Promise<SharedReportLink> {
    return this.inner.revokeSharedReport(id, at);
  }

  seedIfEmpty(seed: SeedData): Promise<boolean> {
    return this.inner.seedIfEmpty(seed);
  }

  /** DATA-4: not recorded; a restore clears the history instead. */
  restoreBackup(data: RestoreData): Promise<void> {
    return this.inner.restoreBackup(data);
  }
}

/** UNDO-5: the task, its sub-tasks (parents first), their completions, and their score links. */
export function taskTreeSnapshot(
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
  scores: readonly Score[],
  rootId: string,
): TaskTreeSnapshot {
  const ordered: Task[] = [];
  const visit = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    ordered.push(task);
    for (const child of tasks) if (child.parentTaskId === id) visit(child.id);
  };
  visit(rootId);
  const ids = new Set(ordered.map((t) => t.id));
  const removed = completions.filter((c) => ids.has(c.taskId));
  const completionIds = new Set(removed.map((c) => c.id));
  return {
    tasks: ordered,
    completions: removed,
    scoreLinks: scores.flatMap((s) =>
      s.taskCompletionId !== null && completionIds.has(s.taskCompletionId)
        ? [{ scoreId: s.id, completionId: s.taskCompletionId }]
        : [],
    ),
  };
}

/** Records every change made through `repo` (UNDO-3). */
export function recordChanges(repo: Repository, options: RecordingOptions): Repository {
  return new RecordingRepository(withoutRecording(repo), options);
}

/** The store underneath, so undo (and anything else that mustn't be recorded) bypasses recording. */
export function withoutRecording(repo: Repository): Repository {
  return repo instanceof RecordingRepository ? repo.inner : repo;
}
