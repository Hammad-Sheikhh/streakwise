import type { SupabaseClient } from '@supabase/supabase-js';

import { throwDbError } from './dbErrors';

// AUTH-5: failed logins per hashed IP. Only failures are stored; a success clears that IP's record.

export interface LoginAttemptStore {
  failuresSince(ipHash: string, since: Date): Promise<Date[]>;
  recordFailure(ipHash: string, at: Date): Promise<void>;
  clear(ipHash: string): Promise<void>;
}

/** Rows older than this are deleted whenever a failure is recorded, so the table stays tiny. */
const RETENTION_MS = 24 * 60 * 60_000;

export class SupabaseLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly db: SupabaseClient) {}

  async failuresSince(ipHash: string, since: Date): Promise<Date[]> {
    const { data, error } = await this.db
      .from('login_attempts')
      .select('attempted_at')
      .eq('ip_hash', ipHash)
      .gte('attempted_at', since.toISOString());
    if (error) throwDbError(error);
    return (data ?? []).map((row: { attempted_at: string }) => new Date(row.attempted_at));
  }

  async recordFailure(ipHash: string, at: Date): Promise<void> {
    const insert = await this.db
      .from('login_attempts')
      .insert({ ip_hash: ipHash, attempted_at: at.toISOString() });
    if (insert.error) throwDbError(insert.error);
    const prune = await this.db
      .from('login_attempts')
      .delete()
      .lt('attempted_at', new Date(at.getTime() - RETENTION_MS).toISOString());
    if (prune.error) throwDbError(prune.error);
  }

  async clear(ipHash: string): Promise<void> {
    const { error } = await this.db.from('login_attempts').delete().eq('ip_hash', ipHash);
    if (error) throwDbError(error);
  }
}
