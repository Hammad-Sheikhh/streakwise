import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { notFound } from '../../../src/core/domain/errors';
import {
  DEFAULT_SETTINGS,
  SCORE_KINDS,
  SESSION_SOURCES,
  TOPIC_STATUSES,
  TRACK_COLORS,
} from '../../../src/core/domain/types';
import type {
  Deadline,
  Score,
  Session,
  SessionFact,
  Settings,
  SharedReportLink,
  Task,
  TaskCompletion,
  TreeNode,
} from '../../../src/core/domain/types';
import type {
  DeadlinePatch,
  NewCompletion,
  NewDeadline,
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
} from '../../../src/core/repo/Repository';
import { throwDbError } from './dbErrors';

// Repository backed by Supabase Postgres (server only, secret key). Rows are validated with Zod on
// the way in, so a schema mismatch fails loudly instead of leaking bad data to the UI.
//
// ACCT-5: one instance serves one user. Every query is limited to that user's rows and every insert
// is stamped with the user's id; the same-owner foreign keys (0003) are the database's backstop.

const toIso = (value: string) => new Date(value).toISOString();
const timestamp = z.string().transform(toIso);

const nodeRow = z
  .object({
    id: z.string(),
    parent_id: z.string().nullable(),
    depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    name: z.string(),
    color: z.enum(TRACK_COLORS).nullable(),
    sort_order: z.number(),
    weekly_target_minutes: z.number().nullable(),
    topic_status: z.enum(TOPIC_STATUSES).nullable(),
    topic_done_at: timestamp.nullable(),
    archived_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .transform((row): TreeNode => ({
    id: row.id,
    parentId: row.parent_id,
    depth: row.depth,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    weeklyTargetMinutes: row.weekly_target_minutes,
    topicStatus: row.topic_status,
    topicDoneAt: row.topic_done_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

const settingsRow = z
  .object({
    student_name: z.string(),
    neglect_days: z.number(),
    last_export_at: timestamp.nullable(),
    last_mcp_call_at: timestamp.nullable(),
  })
  .transform((row): Settings => ({
    studentName: row.student_name,
    neglectDays: row.neglect_days,
    lastExportAt: row.last_export_at,
    lastMcpCallAt: row.last_mcp_call_at,
  }));

const sessionRow = z
  .object({
    id: z.string(),
    node_id: z.string(),
    studied_on: z.string(),
    minutes: z.number(),
    note: z.string().nullable(),
    source: z.enum(SESSION_SOURCES),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .transform((row): Session => ({
    id: row.id,
    nodeId: row.node_id,
    studiedOn: row.studied_on,
    minutes: row.minutes,
    note: row.note,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

const factRow = z
  .object({ node_id: z.string(), studied_on: z.string(), minutes: z.number() })
  .transform((row): SessionFact => ({
    nodeId: row.node_id,
    studiedOn: row.studied_on,
    minutes: row.minutes,
  }));

const deadlineRow = z
  .object({
    id: z.string(),
    node_id: z.string(),
    title: z.string(),
    due_on: z.string(),
    created_at: timestamp,
  })
  .transform((row): Deadline => ({
    id: row.id,
    nodeId: row.node_id,
    title: row.title,
    dueOn: row.due_on,
    createdAt: row.created_at,
  }));

export const sharedReportRow = z
  .object({
    id: z.string(),
    slug: z.string(),
    period_label: z.string(),
    created_at: timestamp,
    expires_at: timestamp.nullable(),
    revoked_at: timestamp.nullable(),
  })
  .transform((row): SharedReportLink => ({
    id: row.id,
    slug: row.slug,
    periodLabel: row.period_label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));

/** The link columns, without the (large) snapshot. */
export const SHARED_REPORT_LINK_COLUMNS =
  'id, slug, period_label, created_at, expires_at, revoked_at';

// Postgres `numeric` columns may arrive as strings, depending on PostgREST settings.
const numeric = z.coerce.number();

const taskRow = z
  .object({
    id: z.string(),
    node_id: z.string().nullable(),
    parent_task_id: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    due_on: z.string().nullable(),
    recurrence: z.enum(['none', 'weekly']),
    is_scored: z.boolean(),
    default_max_score: numeric.nullable(),
    sort_order: z.number(),
    archived_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .transform((row): Task => ({
    id: row.id,
    nodeId: row.node_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    description: row.description,
    dueOn: row.due_on,
    recurrence: row.recurrence,
    isScored: row.is_scored,
    defaultMaxScore: row.default_max_score,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

const completionRow = z
  .object({
    id: z.string(),
    task_id: z.string(),
    period_start: z.string().nullable(),
    completed_at: timestamp,
    note: z.string().nullable(),
  })
  .transform((row): TaskCompletion => ({
    id: row.id,
    taskId: row.task_id,
    periodStart: row.period_start,
    completedAt: row.completed_at,
    note: row.note,
  }));

const scoreRow = z
  .object({
    id: z.string(),
    node_id: z.string(),
    task_completion_id: z.string().nullable(),
    kind: z.enum(SCORE_KINDS),
    title: z.string(),
    taken_on: z.string(),
    score: numeric,
    max_score: numeric,
    note: z.string().nullable(),
    created_at: timestamp,
  })
  .transform((row): Score => ({
    id: row.id,
    nodeId: row.node_id,
    taskCompletionId: row.task_completion_id,
    kind: row.kind,
    title: row.title,
    takenOn: row.taken_on,
    score: row.score,
    maxScore: row.max_score,
    note: row.note,
    createdAt: row.created_at,
  }));

function taskColumns(patch: TaskPatch) {
  return {
    node_id: patch.nodeId,
    title: patch.title,
    description: patch.description,
    due_on: patch.dueOn,
    recurrence: patch.recurrence,
    is_scored: patch.isScored,
    default_max_score: patch.defaultMaxScore,
    sort_order: patch.sortOrder,
    archived_at: patch.archivedAt,
  };
}

function scoreColumns(patch: ScorePatch) {
  return {
    node_id: patch.nodeId,
    kind: patch.kind,
    title: patch.title,
    taken_on: patch.takenOn,
    score: patch.score,
    max_score: patch.maxScore,
    note: patch.note,
  };
}

function nodeColumns(patch: NodePatch) {
  return {
    name: patch.name,
    color: patch.color,
    sort_order: patch.sortOrder,
    weekly_target_minutes: patch.weeklyTargetMinutes,
    topic_status: patch.topicStatus,
    topic_done_at: patch.topicDoneAt,
    archived_at: patch.archivedAt,
  };
}

function sessionColumns(patch: SessionPatch) {
  return {
    node_id: patch.nodeId,
    studied_on: patch.studiedOn,
    minutes: patch.minutes,
    note: patch.note,
  };
}

export class SupabaseRepository implements Repository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  // Every read, update, and delete goes through these, so none can miss the user filter.
  private select(table: string, columns = '*') {
    return this.db.from(table).select(columns).eq('user_id', this.userId);
  }

  private update(table: string, values: Record<string, unknown>) {
    return this.db.from(table).update(values).eq('user_id', this.userId);
  }

  private delete(table: string) {
    return this.db.from(table).delete().eq('user_id', this.userId);
  }

  private insert(table: string, values: Record<string, unknown>) {
    return this.db.from(table).insert({ ...values, user_id: this.userId });
  }

  async listNodes(): Promise<TreeNode[]> {
    const { data, error } = await this.select('nodes');
    if (error) throwDbError(error);
    return z.array(nodeRow).parse(data);
  }

  async insertNode(node: NewNode): Promise<TreeNode> {
    const { data, error } = await this.insert('nodes', {
      id: node.id,
      parent_id: node.parentId,
      depth: 1, // recomputed from the parent by the nodes_set_depth trigger
      name: node.name,
      color: node.color,
      sort_order: node.sortOrder,
      topic_status: node.topicStatus,
    })
      .select()
      .single();
    if (error) throwDbError(error);
    return nodeRow.parse(data);
  }

  async updateNode(id: string, patch: NodePatch): Promise<TreeNode> {
    // supabase-js drops undefined fields, so only the given columns change.
    const { data, error } = await this.update('nodes', nodeColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return nodeRow.parse(data);
  }

  async deleteNodeTree(id: string): Promise<void> {
    const { error } = await this.db.rpc('delete_user_node_tree', {
      p_user_id: this.userId,
      p_node_id: id,
    });
    if (error) throwDbError(error);
  }

  async getSession(id: string): Promise<Session | null> {
    const { data, error } = await this.select('sessions').eq('id', id).maybeSingle();
    if (error) throwDbError(error);
    return data === null ? null : sessionRow.parse(data);
  }

  async insertSession(session: NewSession): Promise<Session> {
    const { data, error } = await this.insert('sessions', {
      id: session.id,
      node_id: session.nodeId,
      studied_on: session.studiedOn,
      minutes: session.minutes,
      note: session.note,
      source: session.source,
    })
      .select()
      .single();
    if (error) throwDbError(error);
    return sessionRow.parse(data);
  }

  async updateSession(id: string, patch: SessionPatch): Promise<Session> {
    const { data, error } = await this.update('sessions', sessionColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return sessionRow.parse(data);
  }

  async deleteSession(id: string): Promise<void> {
    const { data, error } = await this.delete('sessions').eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('session_not_found');
  }

  private filtered(columns: string, filter: SessionFilter) {
    let query = this.select('sessions', columns);
    if (filter.from !== undefined) query = query.gte('studied_on', filter.from);
    if (filter.to !== undefined) query = query.lte('studied_on', filter.to);
    if (filter.nodeIds !== undefined) query = query.in('node_id', filter.nodeIds);
    if (filter.source !== undefined) query = query.eq('source', filter.source);
    return query.order('studied_on', { ascending: false });
  }

  async listSessions(filter: SessionFilter): Promise<Session[]> {
    let query = this.filtered('*', filter).order('created_at', { ascending: false });
    if (filter.limit !== undefined) query = query.limit(filter.limit);
    const { data, error } = await query;
    if (error) throwDbError(error);
    return z.array(sessionRow).parse(data);
  }

  async latestSessionDate(filter: SessionFilter): Promise<string | null> {
    const { data, error } = await this.filtered('studied_on', filter).limit(1);
    if (error) throwDbError(error);
    return z.array(z.object({ studied_on: z.string() })).parse(data)[0]?.studied_on ?? null;
  }

  async listRecentSessions(limit: number): Promise<Session[]> {
    const { data, error } = await this.select('sessions')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throwDbError(error);
    return z.array(sessionRow).parse(data);
  }

  async listSessionFacts(): Promise<SessionFact[]> {
    return z.array(factRow).parse(await this.readAll('sessions', 'node_id, studied_on, minutes'));
  }

  async listAllSessions(): Promise<Session[]> {
    const sessions = z.array(sessionRow).parse(await this.readAll('sessions'));
    return sessions.sort(
      (a, b) => a.studiedOn.localeCompare(b.studiedOn) || a.createdAt.localeCompare(b.createdAt),
    );
  }

  async listDeadlines(): Promise<Deadline[]> {
    const { data, error } = await this.select('deadlines').order('due_on').order('created_at');
    if (error) throwDbError(error);
    return z.array(deadlineRow).parse(data);
  }

  async insertDeadline(deadline: NewDeadline): Promise<Deadline> {
    const { data, error } = await this.insert('deadlines', {
      id: deadline.id,
      node_id: deadline.nodeId,
      title: deadline.title,
      due_on: deadline.dueOn,
    })
      .select()
      .single();
    if (error) throwDbError(error);
    return deadlineRow.parse(data);
  }

  async updateDeadline(id: string, patch: DeadlinePatch): Promise<Deadline> {
    const { data, error } = await this.update('deadlines', {
      node_id: patch.nodeId,
      title: patch.title,
      due_on: patch.dueOn,
    })
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return deadlineRow.parse(data);
  }

  async deleteDeadline(id: string): Promise<void> {
    const { data, error } = await this.delete('deadlines').eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('deadline_not_found');
  }

  /** Reads every row of a table in pages (PostgREST returns at most 1000 per request). */
  private async readAll(table: string, columns = '*'): Promise<unknown[]> {
    const pageSize = 1000;
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.select(table, columns)
        .order('id')
        .range(offset, offset + pageSize - 1);
      if (error) throwDbError(error);
      rows.push(...data);
      if (data.length < pageSize) return rows;
    }
  }

  async listTasks(): Promise<Task[]> {
    return z.array(taskRow).parse(await this.readAll('tasks'));
  }

  async insertTask(task: NewTask): Promise<Task> {
    const { data, error } = await this.insert('tasks', {
      id: task.id,
      parent_task_id: task.parentTaskId,
      ...taskColumns(task),
    })
      .select()
      .single();
    if (error) throwDbError(error);
    return taskRow.parse(data);
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const { data, error } = await this.update('tasks', taskColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return taskRow.parse(data);
  }

  async deleteTask(id: string): Promise<void> {
    // One statement: sub-tasks and completions cascade, linked scores are set null (SPEC §B7).
    const { data, error } = await this.delete('tasks').eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('task_not_found');
  }

  async listTaskCompletions(): Promise<TaskCompletion[]> {
    return z.array(completionRow).parse(await this.readAll('task_completions'));
  }

  async completeTask(input: NewCompletion): Promise<TaskCompletion> {
    const score = input.score && {
      node_id: input.score.nodeId,
      kind: input.score.kind,
      title: input.score.title,
      taken_on: input.score.takenOn,
      score: input.score.score,
      max_score: input.score.maxScore,
      note: input.score.note,
    };
    const { data: completionId, error } = await this.db.rpc('complete_user_task', {
      p_user_id: this.userId,
      p_task_id: input.taskId,
      p_period_start: input.periodStart,
      p_completed_at: input.completedAt,
      p_note: input.note,
      p_score: score,
    });
    if (error) throwDbError(error);
    const { data, error: readError } = await this.select('task_completions')
      .eq('id', z.string().parse(completionId))
      .single();
    if (readError) throwDbError(readError);
    return completionRow.parse(data);
  }

  async uncompleteTask(completionId: string): Promise<void> {
    const { error } = await this.db.rpc('uncomplete_user_task', {
      p_user_id: this.userId,
      p_completion_id: completionId,
    });
    if (error) throwDbError(error);
  }

  async listScores(): Promise<Score[]> {
    const scores = z.array(scoreRow).parse(await this.readAll('scores'));
    return scores.sort(
      (a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt),
    );
  }

  async insertScore(score: NewScore): Promise<Score> {
    const { data, error } = await this.insert('scores', { id: score.id, ...scoreColumns(score) })
      .select()
      .single();
    if (error) throwDbError(error);
    return scoreRow.parse(data);
  }

  async updateScore(id: string, patch: ScorePatch): Promise<Score> {
    const { data, error } = await this.update('scores', scoreColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return scoreRow.parse(data);
  }

  async deleteScore(id: string): Promise<void> {
    const { data, error } = await this.delete('scores').eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('score_not_found');
  }

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.select('user_settings').maybeSingle();
    if (error) throwDbError(error);
    // The row is created on first login (seed or claim); until then the defaults apply.
    return data === null ? { ...DEFAULT_SETTINGS } : settingsRow.parse(data);
  }

  /** Writes settings columns, creating the user's row if it doesn't exist yet. */
  private async upsertSettings(values: Record<string, unknown>) {
    return this.db
      .from('user_settings')
      .upsert({ ...values, user_id: this.userId }, { onConflict: 'user_id' })
      .select()
      .single();
  }

  async updateSettings(patch: SettingsPatch): Promise<Settings> {
    const { data, error } = await this.upsertSettings({
      student_name: patch.studentName,
      neglect_days: patch.neglectDays,
    });
    if (error) throwDbError(error);
    return settingsRow.parse(data);
  }

  async recordMcpCall(at: string): Promise<void> {
    const { error } = await this.upsertSettings({ last_mcp_call_at: at });
    if (error) throwDbError(error);
  }

  async recordExport(at: string): Promise<void> {
    const { error } = await this.upsertSettings({ last_export_at: at });
    if (error) throwDbError(error);
  }

  async insertSharedReport(report: NewSharedReport): Promise<SharedReportLink> {
    const { data, error } = await this.insert('shared_reports', {
      id: report.id,
      slug: report.slug,
      snapshot: report.snapshot,
      period_label: report.periodLabel,
      expires_at: report.expiresAt,
    })
      .select(SHARED_REPORT_LINK_COLUMNS)
      .single();
    if (error) throwDbError(error);
    return sharedReportRow.parse(data);
  }

  async listSharedReports(): Promise<SharedReportLink[]> {
    const { data, error } = await this.select('shared_reports', SHARED_REPORT_LINK_COLUMNS).order(
      'created_at',
      { ascending: false },
    );
    if (error) throwDbError(error);
    return z.array(sharedReportRow).parse(data);
  }

  async revokeSharedReport(id: string, at: string): Promise<SharedReportLink> {
    // Only a link that isn't revoked yet is stamped, so the first revocation time is kept.
    const { error } = await this.update('shared_reports', { revoked_at: at })
      .eq('id', id)
      .is('revoked_at', null);
    if (error) throwDbError(error);
    const { data, error: readError } = await this.select(
      'shared_reports',
      SHARED_REPORT_LINK_COLUMNS,
    )
      .eq('id', id)
      .maybeSingle();
    if (readError) throwDbError(readError);
    if (data === null) throw notFound('share_not_found');
    return sharedReportRow.parse(data);
  }

  async seedIfEmpty(seed: SeedData): Promise<boolean> {
    const payload = {
      nodes: seed.nodes.map((node) => ({
        id: node.id,
        parent_id: node.parentId,
        name: node.name,
        color: node.color,
        sort_order: node.sortOrder,
      })),
      tasks: seed.tasks.map((task) => ({
        id: task.id,
        node_id: task.nodeId,
        title: task.title,
        recurrence: task.recurrence,
        is_scored: task.isScored,
        default_max_score: task.defaultMaxScore,
        sort_order: task.sortOrder,
      })),
    };
    const { data, error } = await this.db.rpc('seed_user_if_empty', {
      p_user_id: this.userId,
      p_payload: payload,
    });
    if (error) throwDbError(error);
    return z.boolean().parse(data);
  }
}
