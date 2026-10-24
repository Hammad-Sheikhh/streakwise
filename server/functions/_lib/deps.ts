import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import type { Clock, IdGenerator } from '../../../src/core/domain/types';
import { newShareSlug } from '../../../src/core/logic/slug';
import type { SlugGenerator } from '../../../src/core/logic/slug';
import type { Repository } from '../../../src/core/repo/Repository';
import { SupabaseAccountStore } from './accounts';
import type { AccountStore } from './accounts';
import { SupabaseAuthProvider } from './authProvider';
import type { AuthProvider } from './authProvider';
import { readServerEnv } from './env';
import type { ServerEnv } from './env';
import { SupabaseLoginAttemptStore } from './loginAttempts';
import type { LoginAttemptStore } from './loginAttempts';
import { SupabasePublicShareStore } from './publicShares';
import type { PublicShareStore } from './publicShares';
import { SupabaseRepository } from './SupabaseRepository';

// Everything a handler needs from the outside world. Tests pass in-memory versions instead.
export interface ServerDeps {
  env: ServerEnv;
  /** ACCT-5: study data, limited to one user. */
  repoFor: (userId: string) => Repository;
  auth: AuthProvider;
  accounts: AccountStore;
  loginAttempts: LoginAttemptStore;
  /** SHARE-2: public reads of shared reports by slug. */
  shares: PublicShareStore;
  clock: Clock;
  newId: IdGenerator;
  newSlug: SlugGenerator;
}

/** What a handler that requires login gets: the deps plus the logged-in user's repository. */
export interface UserDeps extends ServerDeps {
  userId: string;
  repo: Repository;
}

export function forUser(deps: ServerDeps, userId: string): UserDeps {
  return { ...deps, userId, repo: deps.repoFor(userId) };
}

let cached: ServerDeps | undefined;

/** Built on first use and reused while the function instance stays warm. */
export function serverDeps(): ServerDeps {
  if (cached) return cached;
  const env = readServerEnv();
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cached = {
    env,
    repoFor: (userId) => new SupabaseRepository(db, userId),
    auth: new SupabaseAuthProvider(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    accounts: new SupabaseAccountStore(db),
    loginAttempts: new SupabaseLoginAttemptStore(db),
    shares: new SupabasePublicShareStore(db),
    clock: () => new Date(),
    newId: randomUUID,
    newSlug: newShareSlug,
  };
  return cached;
}
