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
}

export type NetlifyHandler = (request: Request, context: Pick<Context, 'ip'>) => Promise<Response>;

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
      return await handle({ request, deps, ip: context.ip });
    } catch (error) {
      return toErrorResponse(error, options.route);
    }
  };
}
