import type { Context } from '@netlify/functions';

import type { AccountStore } from './accounts';
import { readCookie, readSessionToken, SESSION_COOKIE } from './auth';
import { forUser } from './deps';
import type { ServerDeps, UserDeps } from './deps';
import { errorJson, toErrorResponse } from './http';

// Wraps every /api handler: the login check (AUTH-3, ACCT-3, ACCT-5), then the handler, with all
// errors turned into the standard JSON error shape.

interface BaseRequest {
  request: Request;
  ip: string;
  /** Route parameters from `config.path`, e.g. `{ id }` for `/api/nodes/:id`. */
  params: Record<string, string>;
}

/** A request to a route that needs login: `deps.repo` only reaches the user's own data. */
export interface ApiRequest extends BaseRequest {
  deps: UserDeps;
}

export interface PublicRequest extends BaseRequest {
  deps: ServerDeps;
}

export type NetlifyHandler = (
  request: Request,
  context: Pick<Context, 'ip'> & Partial<Pick<Context, 'params'>>,
) => Promise<Response>;

// A password change sets `sessions_valid_after`; reading it on every request would add a database
// round trip, so a warm function instance remembers it briefly. Revocation takes effect within
// this time on other devices.
// The cache belongs to the account store, so separate stores (as in tests) never share it.
const VALID_AFTER_CACHE_MS = 60_000;
type ValidAfterCache = Map<string, { value: Date | null; readAt: number }>;
const validAfterCaches = new WeakMap<AccountStore, ValidAfterCache>();

function cacheFor(accounts: AccountStore): ValidAfterCache {
  let cache = validAfterCaches.get(accounts);
  if (!cache) {
    cache = new Map();
    validAfterCaches.set(accounts, cache);
  }
  return cache;
}

async function sessionsValidAfter(deps: ServerDeps, userId: string): Promise<Date | null> {
  const cache = cacheFor(deps.accounts);
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.readAt < VALID_AFTER_CACHE_MS) return cached.value;
  const value = await deps.accounts.sessionsValidAfter(userId);
  cache.set(userId, { value, readAt: now });
  return value;
}

/** Called after a password change, so this instance stops accepting old cookies at once. */
export function forgetSessionCache(deps: ServerDeps, userId: string): void {
  cacheFor(deps.accounts).delete(userId);
}

/** The logged-in user's id, or null if the request has no valid, unrevoked session cookie. */
export async function sessionUserId(deps: ServerDeps, request: Request): Promise<string | null> {
  const session = readSessionToken(
    deps.env.SESSION_SECRET,
    readCookie(request, SESSION_COOKIE),
    deps.clock(),
  );
  if (!session) return null;
  const validAfter = await sessionsValidAfter(deps, session.userId);
  if (validAfter && session.issuedAt < validAfter) return null;
  return session.userId;
}

export function apiHandler(
  options: { route: string; auth: true },
  getDeps: () => ServerDeps,
  handle: (input: ApiRequest) => Promise<Response>,
): NetlifyHandler;
export function apiHandler(
  options: { route: string; auth: false },
  getDeps: () => ServerDeps,
  handle: (input: PublicRequest) => Promise<Response>,
): NetlifyHandler;
export function apiHandler(
  options: { route: string; auth: boolean },
  getDeps: () => ServerDeps,
  handle:
    ((input: ApiRequest) => Promise<Response>) | ((input: PublicRequest) => Promise<Response>),
): NetlifyHandler {
  return async (request, context) => {
    try {
      const deps = getDeps();
      const base = { request, ip: context.ip, params: context.params ?? {} };
      // The overloads pair `auth` with the matching handler type.
      if (!options.auth) {
        return await (handle as (input: PublicRequest) => Promise<Response>)({ ...base, deps });
      }
      const userId = await sessionUserId(deps, request);
      if (!userId) return errorJson(401, 'unauthenticated', 'Please log in.');
      return await (handle as (input: ApiRequest) => Promise<Response>)({
        ...base,
        deps: forUser(deps, userId),
      });
    } catch (error) {
      return toErrorResponse(error, options.route);
    }
  };
}

/** Picks the handler for the request's method; anything else is a 405. */
export function byMethod<T extends BaseRequest>(
  handlers: Partial<Record<string, (input: T) => Promise<Response>>>,
): (input: T) => Promise<Response> {
  return async (input) => {
    const handle = handlers[input.request.method];
    if (!handle) return errorJson(405, 'method_not_allowed', 'That action isn’t supported here.');
    return handle(input);
  };
}

/** The `:id` route parameter; a missing one means the route is misconfigured. */
export function idParam({ params }: BaseRequest): string {
  const id = params.id;
  if (!id) throw new Error('Route parameter "id" is missing');
  return id;
}
