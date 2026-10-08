import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { throwDbError } from './dbErrors';

// Account-level data that isn't part of one user's study data: claiming the data from before
// accounts (ACCT-7), Claude link tokens (ACCT-8), session revocation, and request limits (ACCT-10).

export type AuthRequestKind = 'signup' | 'reset';

export interface AccountStore {
  hasUnclaimedData(): Promise<boolean>;
  /** Atomically gives every unclaimed row to the user. Raises conflict if that's not possible. */
  claimUnclaimedData(userId: string): Promise<void>;
  /** The user whose Claude link has this token hash, if any. */
  userIdForMcpTokenHash(tokenHash: string): Promise<string | null>;
  hasMcpToken(userId: string): Promise<boolean>;
  setMcpTokenHash(userId: string, tokenHash: string): Promise<void>;
  /** Login cookies issued before this time are refused. */
  sessionsValidAfter(userId: string): Promise<Date | null>;
  setSessionsValidAfter(userId: string, at: Date): Promise<void>;
  authRequestsSince(ipHash: string, kind: AuthRequestKind, since: Date): Promise<number>;
  recordAuthRequest(ipHash: string, kind: AuthRequestKind, at: Date): Promise<void>;
  /** OPS-2: one trivial read, so Supabase sees activity and doesn't pause the project. */
  ping(): Promise<void>;
}

/** Old request rows are deleted whenever a new one is recorded, so the table stays tiny. */
const RETENTION_MS = 24 * 60 * 60_000;

export class SupabaseAccountStore implements AccountStore {
  constructor(private readonly db: SupabaseClient) {}

  async hasUnclaimedData(): Promise<boolean> {
    const { data, error } = await this.db.rpc('has_unclaimed_data');
    if (error) throwDbError(error);
    return z.boolean().parse(data);
  }

  async claimUnclaimedData(userId: string): Promise<void> {
    const { error } = await this.db.rpc('claim_unclaimed_data', { p_user_id: userId });
    if (error) throwDbError(error);
  }

  async userIdForMcpTokenHash(tokenHash: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('user_settings')
      .select('user_id')
      .eq('mcp_token_hash', tokenHash)
      .maybeSingle();
    if (error) throwDbError(error);
    return data === null ? null : z.object({ user_id: z.string() }).parse(data).user_id;
  }

  async hasMcpToken(userId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('user_settings')
      .select('mcp_token_hash')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throwDbError(error);
    return z.object({ mcp_token_hash: z.string().nullable() }).nullable().parse(data)
      ?.mcp_token_hash
      ? true
      : false;
  }

  async setMcpTokenHash(userId: string, tokenHash: string): Promise<void> {
    const { error } = await this.db
      .from('user_settings')
      .upsert({ user_id: userId, mcp_token_hash: tokenHash }, { onConflict: 'user_id' });
    if (error) throwDbError(error);
  }

  async sessionsValidAfter(userId: string): Promise<Date | null> {
    const { data, error } = await this.db
      .from('user_settings')
      .select('sessions_valid_after')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throwDbError(error);
    const value = z
      .object({ sessions_valid_after: z.string().nullable() })
      .nullable()
      .parse(data)?.sessions_valid_after;
    return value ? new Date(value) : null;
  }

  async setSessionsValidAfter(userId: string, at: Date): Promise<void> {
    const { error } = await this.db
      .from('user_settings')
      .upsert(
        { user_id: userId, sessions_valid_after: at.toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throwDbError(error);
  }

  async authRequestsSince(ipHash: string, kind: AuthRequestKind, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from('auth_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('kind', kind)
      .gte('requested_at', since.toISOString());
    if (error) throwDbError(error);
    return count ?? 0;
  }

  async recordAuthRequest(ipHash: string, kind: AuthRequestKind, at: Date): Promise<void> {
    const insert = await this.db
      .from('auth_requests')
      .insert({ ip_hash: ipHash, kind, requested_at: at.toISOString() });
    if (insert.error) throwDbError(insert.error);
    const prune = await this.db
      .from('auth_requests')
      .delete()
      .lt('requested_at', new Date(at.getTime() - RETENTION_MS).toISOString());
    if (prune.error) throwDbError(prune.error);
  }

  async ping(): Promise<void> {
    const { error } = await this.db.from('user_settings').select('user_id').limit(1);
    if (error) throwDbError(error);
  }
}
