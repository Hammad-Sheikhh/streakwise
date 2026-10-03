import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { notFound } from '../../../src/core/domain/errors';
import { SESSION_SOURCES, TOPIC_STATUSES, TRACK_COLORS } from '../../../src/core/domain/types';
import type {
  Deadline,
  Session,
  SessionFact,
  Settings,
  TreeNode,
} from '../../../src/core/domain/types';
import type {
  DeadlinePatch,
  NewDeadline,
  NewNode,
  NewSession,
  NodePatch,
  Repository,
  SeedData,
  SessionFilter,
  SessionPatch,
  SettingsPatch,
} from '../../../src/core/repo/Repository';
import { throwDbError } from './dbErrors';

// Repository backed by Supabase Postgres (server only, secret key). Rows are validated with Zod on
// the way in, so a schema mismatch fails loudly instead of leaking bad data to the UI.

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
  constructor(private readonly db: SupabaseClient) {}

  async listNodes(): Promise<TreeNode[]> {
    const { data, error } = await this.db.from('nodes').select('*');
    if (error) throwDbError(error);
    return z.array(nodeRow).parse(data);
  }

  async insertNode(node: NewNode): Promise<TreeNode> {
    const { data, error } = await this.db
      .from('nodes')
      .insert({
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
    const { data, error } = await this.db
      .from('nodes')
      .update(nodeColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return nodeRow.parse(data);
  }

  async deleteNodeTree(id: string): Promise<void> {
    const { error } = await this.db.rpc('delete_node_tree', { p_node_id: id });
    if (error) throwDbError(error);
  }

  async getSession(id: string): Promise<Session | null> {
    const { data, error } = await this.db.from('sessions').select('*').eq('id', id).maybeSingle();
    if (error) throwDbError(error);
    return data === null ? null : sessionRow.parse(data);
  }

  async insertSession(session: NewSession): Promise<Session> {
    const { data, error } = await this.db
      .from('sessions')
      .insert({
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
    const { data, error } = await this.db
      .from('sessions')
      .update(sessionColumns(patch))
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return sessionRow.parse(data);
  }

  async deleteSession(id: string): Promise<void> {
    const { data, error } = await this.db.from('sessions').delete().eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('session_not_found');
  }

  private filtered(columns: string, filter: SessionFilter) {
    let query = this.db.from('sessions').select(columns);
    if (filter.from !== undefined) query = query.gte('studied_on', filter.from);
    if (filter.to !== undefined) query = query.lte('studied_on', filter.to);
    if (filter.nodeIds !== undefined) query = query.in('node_id', filter.nodeIds);
    if (filter.source !== undefined) query = query.eq('source', filter.source);
    return query.order('studied_on', { ascending: false });
  }

  async listSessions(filter: SessionFilter): Promise<Session[]> {
    const { data, error } = await this.filtered('*', filter).order('created_at', {
      ascending: false,
    });
    if (error) throwDbError(error);
    return z.array(sessionRow).parse(data);
  }

  async latestSessionDate(filter: SessionFilter): Promise<string | null> {
    const { data, error } = await this.filtered('studied_on', filter).limit(1);
    if (error) throwDbError(error);
    return z.array(z.object({ studied_on: z.string() })).parse(data)[0]?.studied_on ?? null;
  }

  async listRecentSessions(limit: number): Promise<Session[]> {
    const { data, error } = await this.db
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throwDbError(error);
    return z.array(sessionRow).parse(data);
  }

  async listSessionFacts(): Promise<SessionFact[]> {
    // PostgREST returns at most 1000 rows per request (Supabase's default), so read in pages.
    const pageSize = 1000;
    const facts: SessionFact[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.db
        .from('sessions')
        .select('node_id, studied_on, minutes')
        .order('id')
        .range(offset, offset + pageSize - 1);
      if (error) throwDbError(error);
      const rows = z.array(factRow).parse(data);
      facts.push(...rows);
      if (rows.length < pageSize) return facts;
    }
  }

  async listDeadlines(): Promise<Deadline[]> {
    const { data, error } = await this.db
      .from('deadlines')
      .select('*')
      .order('due_on')
      .order('created_at');
    if (error) throwDbError(error);
    return z.array(deadlineRow).parse(data);
  }

  async insertDeadline(deadline: NewDeadline): Promise<Deadline> {
    const { data, error } = await this.db
      .from('deadlines')
      .insert({
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
    const { data, error } = await this.db
      .from('deadlines')
      .update({ node_id: patch.nodeId, title: patch.title, due_on: patch.dueOn })
      .eq('id', id)
      .select()
      .single();
    if (error) throwDbError(error);
    return deadlineRow.parse(data);
  }

  async deleteDeadline(id: string): Promise<void> {
    const { data, error } = await this.db.from('deadlines').delete().eq('id', id).select('id');
    if (error) throwDbError(error);
    if (data.length === 0) throw notFound('deadline_not_found');
  }

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.db.from('settings').select('*').eq('id', true).single();
    if (error) throwDbError(error);
    return settingsRow.parse(data);
  }

  async updateSettings(patch: SettingsPatch): Promise<Settings> {
    const { data, error } = await this.db
      .from('settings')
      .update({ student_name: patch.studentName, neglect_days: patch.neglectDays })
      .eq('id', true)
      .select()
      .single();
    if (error) throwDbError(error);
    return settingsRow.parse(data);
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
    const { data, error } = await this.db.rpc('seed_if_empty', { p_payload: payload });
    if (error) throwDbError(error);
    return z.boolean().parse(data);
  }

  /** OPS-2: one trivial read, so Supabase sees activity and doesn't pause the project. */
  async ping(): Promise<void> {
    const { error } = await this.db.from('settings').select('id').limit(1);
    if (error) throwDbError(error);
  }
}
