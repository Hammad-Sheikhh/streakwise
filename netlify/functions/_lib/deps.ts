import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import type { Clock, IdGenerator } from '../../../src/core/domain/types';
import type { Repository } from '../../../src/core/repo/Repository';
import { readServerEnv } from './env';
import type { ServerEnv } from './env';
import { SupabaseLoginAttemptStore } from './loginAttempts';
import type { LoginAttemptStore } from './loginAttempts';
import { SupabaseRepository } from './SupabaseRepository';

// Everything a handler needs from the outside world. Tests pass in-memory versions instead.
export interface ServerDeps {
  env: ServerEnv;
  repo: Repository;
  loginAttempts: LoginAttemptStore;
  ping: () => Promise<void>;
  clock: Clock;
  newId: IdGenerator;
}

let cached: ServerDeps | undefined;

/** Built on first use and reused while the function instance stays warm. */
export function serverDeps(): ServerDeps {
  if (cached) return cached;
  const env = readServerEnv();
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repo = new SupabaseRepository(db);
  cached = {
    env,
    repo,
    loginAttempts: new SupabaseLoginAttemptStore(db),
    ping: () => repo.ping(),
    clock: () => new Date(),
    newId: randomUUID,
  };
  return cached;
}
