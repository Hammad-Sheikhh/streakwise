import type {
  Deadline,
  Session,
  SessionFact,
  SessionSource,
  Settings,
  TaskRecurrence,
  TopicStatus,
  TrackColor,
  TreeNode,
} from '../domain/types';

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

export type NewDeadline = Pick<Deadline, 'id' | 'nodeId' | 'title' | 'dueOn'>;
export type DeadlinePatch = Partial<Pick<Deadline, 'nodeId' | 'title' | 'dueOn'>>;

export type NewSession = Pick<
  Session,
  'id' | 'nodeId' | 'studiedOn' | 'minutes' | 'note' | 'source'
>;

export type SessionPatch = Partial<Pick<Session, 'nodeId' | 'studiedOn' | 'minutes' | 'note'>>;

/** All bounds are inclusive local dates. */
export interface SessionFilter {
  from?: string;
  to?: string;
  nodeIds?: string[];
  source?: SessionSource;
}

export type SettingsPatch = Partial<Pick<Settings, 'studentName' | 'neglectDays'>>;

export interface Repository {
  listNodes(): Promise<TreeNode[]>;
  insertNode(node: NewNode): Promise<TreeNode>;
  updateNode(id: string, patch: NodePatch): Promise<TreeNode>;
  /** Atomically deletes the node and its descendants; refuses if any of them has history. */
  deleteNodeTree(id: string): Promise<void>;

  getSession(id: string): Promise<Session | null>;
  insertSession(session: NewSession): Promise<Session>;
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

  /** Ordered by due date. */
  listDeadlines(): Promise<Deadline[]>;
  insertDeadline(deadline: NewDeadline): Promise<Deadline>;
  updateDeadline(id: string, patch: DeadlinePatch): Promise<Deadline>;
  deleteDeadline(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsPatch): Promise<Settings>;

  /** Atomically writes the seed if there are no nodes yet. Returns whether it seeded. */
  seedIfEmpty(seed: SeedData): Promise<boolean>;
}
