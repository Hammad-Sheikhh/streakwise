import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { TOPIC_STATUSES, TRACK_COLORS } from '../../../src/core/domain/types';
import type { Settings, TreeNode } from '../../../src/core/domain/types';
import type { Repository, SeedData } from '../../../src/core/repo/Repository';
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

export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient) {}

  async listNodes(): Promise<TreeNode[]> {
    const { data, error } = await this.db.from('nodes').select('*');
    if (error) throwDbError(error);
    return z.array(nodeRow).parse(data);
  }

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.db.from('settings').select('*').eq('id', true).single();
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
