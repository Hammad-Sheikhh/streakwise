import type { Context } from '@netlify/functions';

import { isValidSessionToken, readCookie, SESSION_COOKIE } from './auth';
import type { ServerDeps } from './deps';
import { errorJson, toErrorResponse } from './http';

// Wraps every /api handler: optional session check (AUTH-3), then the handler, with all errors
// turned into the standard JSON error shape.

export interface ApiRequest {
  request: Request;
  deps: ServerDeps;
  ip: string;
  /** Route parameters from `config.path`, e.g. `{ id }` for `/api/nodes/:id`. */
  params: Record<string, string>;
}

export type NetlifyHandler = (
  request: Request,
  context: Pick<Context, 'ip'> & Partial<Pick<Context, 'params'>>,
) => Promise<Response>;

export function apiHandler(
  options: { route: string; auth: boolean },
  getDeps: () => ServerDeps,
  handle: (input: ApiRequest) => Promise<Response>,
): NetlifyHandler {
  return async (request, context) => {
    try {
      const deps = getDeps();
      if (options.auth) {
        const token = readCookie(request, SESSION_COOKIE);
        const keys = { sessionSecret: deps.env.SESSION_SECRET, passcode: deps.env.APP_PASSCODE };
        if (!token || !isValidSessionToken(token, keys, deps.clock())) {
          return errorJson(401, 'unauthenticated', 'Please log in.');
        }
      }
      return await handle({ request, deps, ip: context.ip, params: context.params ?? {} });
    } catch (error) {
      return toErrorResponse(error, options.route);
    }
  };
}

/** Picks the handler for the request's method; anything else is a 405. */
export function byMethod(
  handlers: Partial<Record<string, (input: ApiRequest) => Promise<Response>>>,
): (input: ApiRequest) => Promise<Response> {
  return async (input) => {
    const handle = handlers[input.request.method];
    if (!handle) return errorJson(405, 'method_not_allowed', 'That action isn’t supported here.');
    return handle(input);
  };
}

/** The `:id` route parameter; a missing one means the route is misconfigured. */
export function idParam({ params }: ApiRequest): string {
  const id = params.id;
  if (!id) throw new Error('Route parameter "id" is missing');
  return id;
}
