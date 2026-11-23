import type {
  ChangeEntry,
  Deadline,
  ExamTarget,
  Mistake,
  Report,
  RestoreData,
  Score,
  Session,
  SessionFact,
  SessionSource,
  Settings,
  SharedReportLink,
  Task,
  TaskCompletion,
  TaskRecurrence,
  TopicStatus,
  TrackColor,
  TreeNode,
} from '../domain/types.js';

// Storage used by the core services. SupabaseRepository (server) and InMemoryRepository (demo mode
// and tests) implement it. Later milestones add methods for tasks, scores, and so on.
//
// Errors: a missing row raises DomainError('not_found'), a sibling-name clash or an in-use node
// raises DomainError('conflict'). Services check these rules first with friendlier messages; the
// repository is the backstop.

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

/** Depth is derived from the parent by the store. */
export interface NewNode {
  id: string;
  parentId: string | null;
  name: string;
  color: TrackColor | null;
  sortOrder: number;
  topicStatus: TopicStatus | null;
}

export type NodePatch = Partial<
  Pick<
    TreeNode,
    | 'name'
    | 'color'
    | 'sortOrder'
    | 'weeklyTargetMinutes'
    | 'topicStatus'
    | 'topicDoneAt'
    | 'archivedAt'
  >
>;

export type NewDeadline = Pick<Deadline, 'id' | 'nodeId' | 'title' | 'dueOn' | 'isExam'> & {
  /** Only when undo brings back a deleted deadline (UNDO-5). */
  createdAt?: string;
};
export type DeadlinePatch = Partial<Pick<Deadline, 'nodeId' | 'title' | 'dueOn' | 'isExam'>>;

export type NewExamTarget = Pick<
  ExamTarget,
  'id' | 'deadlineId' | 'label' | 'targetOn' | 'minPercent'
> & {
  /** Only when undo brings back a deleted target. */
  createdAt?: string;
};
export type ExamTargetPatch = Partial<Pick<ExamTarget, 'label' | 'targetOn' | 'minPercent'>>;

export type NewSession = Pick<
  Session,
  'id' | 'nodeId' | 'studiedOn' | 'minutes' | 'note' | 'source'
> & {
  /** Only when undo brings back a deleted session (UNDO-5), so its place in lists is kept. */
  createdAt?: string;
};

export type SessionPatch = Partial<Pick<Session, 'nodeId' | 'studiedOn' | 'minutes' | 'note'>>;

/** All bounds are inclusive local dates. */
export interface SessionFilter {
  from?: string;
  to?: string;
  nodeIds?: string[];
  source?: SessionSource;
  /** MCP-16, DATA-1: the note contains this text (case-insensitive). */
  noteContains?: string;
  /** MCP-17: the note starts with this text (case-insensitive). */
  noteStartsWith?: string;
  /** Only the newest this many (listSessions only). */
  limit?: number;
}

export type NewTask = Pick<
  Task,
  | 'id'
  | 'nodeId'
  | 'parentTaskId'
  | 'title'
  | 'description'
  | 'dueOn'
  | 'recurrence'
  | 'isScored'
  | 'defaultMaxScore'
  | 'sortOrder'
>;

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'nodeId'
    | 'title'
    | 'description'
    | 'dueOn'
    | 'recurrence'
    | 'isScored'
    | 'defaultMaxScore'
    | 'sortOrder'
    | 'archivedAt'
  >
>;

type ScoreFields = Pick<
  Score,
  'id' | 'nodeId' | 'kind' | 'title' | 'takenOn' | 'score' | 'maxScore' | 'note'
>;
export type NewScore = ScoreFields & {
  /** Only when undo brings back a deleted score (UNDO-5): its link and creation time. */
  taskCompletionId?: string | null;
  createdAt?: string;
};
export type ScorePatch = Partial<Omit<ScoreFields, 'id'>>;

/** TASK-6: a completion and, for scored tasks, the score recorded with it, written atomically. */
export interface NewCompletion {
  /** Set only when undo brings back a completion with its old id (UNDO-5). */
  id?: string;
  taskId: string;
  periodStart: string | null;
  completedAt: string;
  /** TASK-11. */
  completedOn: string;
  note: string | null;
  score: NewScore | null;
}

/** UNDO-5: everything a task delete removed, so undo can put it back as it was. */
export interface TaskTreeSnapshot {
  /** The task and its sub-tasks, parents first. */
  tasks: Task[];
  completions: TaskCompletion[];
  /** Scores that were linked to those completions (they were kept, unlinked). */
  scoreLinks: { scoreId: string; completionId: string }[];
}

export type NewMistake = Omit<Mistake, 'createdAt' | 'updatedAt'> & {
  /** Only when undo brings back a deleted mistake. */
  createdAt?: string;
};
export type MistakePatch = Partial<
  Omit<Mistake, 'id' | 'createdOn' | 'source' | 'createdAt' | 'updatedAt'>
>;

/** UNDO-3: the store sets the time (strictly increasing per user) and `undoneAt`. */
export type NewChange = Omit<ChangeEntry, 'at' | 'undoneAt'>;

/** SHARE-1. */
export interface NewSharedReport {
  id: string;
  slug: string;
  snapshot: Report;
  periodLabel: string;
  expiresAt: string | null;
}

export type SettingsPatch = Partial<
  Pick<Settings, 'studentName' | 'neglectDays' | 'dayEndsAtMinutes'>
>;

export interface Repository {
  listNodes(): Promise<TreeNode[]>;
  insertNode(node: NewNode): Promise<TreeNode>;
  updateNode(id: string, patch: NodePatch): Promise<TreeNode>;
  /** Atomically deletes the node and its descendants; refuses if any of them has history. */
  deleteNodeTree(id: string): Promise<void>;
  /** UNDO-5: puts deleted nodes back exactly as they were (listed parents first), in one write. */
  restoreNodes(nodes: TreeNode[]): Promise<void>;

  getSession(id: string): Promise<Session | null>;
  insertSession(session: NewSession): Promise<Session>;
  /** MCP-20: several sessions in one atomic write, returned in the same order. */
  insertSessions(sessions: NewSession[]): Promise<Session[]>;
  updateSession(id: string, patch: SessionPatch): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  /** Newest first: by date, then by creation time. */
  listSessions(filter: SessionFilter): Promise<Session[]>;
  /** The latest date with a matching session, or null. */
  latestSessionDate(filter: SessionFilter): Promise<string | null>;
  /** The most recently created sessions, newest first. */
  listRecentSessions(limit: number): Promise<Session[]>;
  /** Node, date, and minutes of every session (all history), for dashboard calculations. */
  listSessionFacts(): Promise<SessionFact[]>;
  /** Every session (SET-2 export), oldest first. */
  listAllSessions(): Promise<Session[]>;

  /** Ordered by due date. */
  listDeadlines(): Promise<Deadline[]>;
  insertDeadline(deadline: NewDeadline): Promise<Deadline>;
  updateDeadline(id: string, patch: DeadlinePatch): Promise<Deadline>;
  /** Deleting a deadline deletes its exam targets too. */
  deleteDeadline(id: string): Promise<void>;

  /** EXAM-3: every exam target, by date. */
  listExamTargets(): Promise<ExamTarget[]>;
  insertExamTarget(target: NewExamTarget): Promise<ExamTarget>;
  updateExamTarget(id: string, patch: ExamTargetPatch): Promise<ExamTarget>;
  deleteExamTarget(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  insertTask(task: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  /** Deletes the task, its sub-tasks, and their completions; linked scores are kept, unlinked. */
  deleteTask(id: string): Promise<void>;
  /** UNDO-5: atomically puts back a deleted task tree, its completions, and its score links. */
  restoreTaskTree(snapshot: TaskTreeSnapshot): Promise<void>;

  listTaskCompletions(): Promise<TaskCompletion[]>;
  /** Atomic; raises conflict('already_completed') if the period already has a completion. */
  completeTask(completion: NewCompletion): Promise<TaskCompletion>;
  /** Atomically deletes the completion and any score recorded with it. */
  uncompleteTask(completionId: string): Promise<void>;

  /** Newest first: by date taken, then by creation time. */
  listScores(): Promise<Score[]>;
  insertScore(score: NewScore): Promise<Score>;
  updateScore(id: string, patch: ScorePatch): Promise<Score>;
  deleteScore(id: string): Promise<void>;

  /** ERR: every mistake, in no particular order. */
  listMistakes(): Promise<Mistake[]>;
  insertMistake(mistake: NewMistake): Promise<Mistake>;
  updateMistake(id: string, patch: MistakePatch): Promise<Mistake>;
  deleteMistake(id: string): Promise<void>;

  /** UNDO-3: records one change. */
  insertChange(change: NewChange): Promise<ChangeEntry>;
  /** UNDO-4: changes made at or after `since`, newest first, at most `limit`. */
  listChanges(filter: { since: string; limit: number }): Promise<ChangeEntry[]>;
  getChange(id: string): Promise<ChangeEntry | null>;
  /** UNDO-5: changes to the same item made after this one that haven't been undone. */
  laterChanges(id: string): Promise<ChangeEntry[]>;
  markChangeUndone(id: string, at: string): Promise<ChangeEntry>;
  /** UNDO-7: removes entries older than `at`. */
  deleteChangesBefore(at: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsPatch): Promise<Settings>;
  /** MCP-4: stamps the time of the latest Claude (MCP) tool call. */
  recordMcpCall(at: string): Promise<void>;
  /** SET-2: stamps the time of the latest export. */
  recordExport(at: string): Promise<void>;

  /** SHARE-1. */
  insertSharedReport(report: NewSharedReport): Promise<SharedReportLink>;
  /** SHARE-3: newest first. */
  listSharedReports(): Promise<SharedReportLink[]>;
  /** SHARE-3: marks the link revoked (once; revoking again keeps the first time). */
  revokeSharedReport(id: string, at: string): Promise<SharedReportLink>;

  /** Atomically writes the seed if there are no nodes yet. Returns whether it seeded. */
  seedIfEmpty(seed: SeedData): Promise<boolean>;

  /**
   * DATA-4: replaces all study data and the name, neglect, and "day ends at" settings in one
   * atomic write, and clears the change history. Keeps the account, the Claude link, shared
   * links, and the export and MCP times.
   */
  restoreBackup(data: RestoreData): Promise<void>;
}
