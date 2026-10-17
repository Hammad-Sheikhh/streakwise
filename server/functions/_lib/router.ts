import type { RequestHandler } from './api';
import type { ServerDeps } from './deps';

import { createAccountHandler } from '../auth-account';
import { createConfirmHandler } from '../auth-confirm';
import { createForgotHandler } from '../auth-forgot';
import { createLoginHandler } from '../auth-login';
import { createLogoutHandler } from '../auth-logout';
import { createMeHandler } from '../auth-me';
import { createPasswordHandler } from '../auth-password';
import { createResendHandler } from '../auth-resend';
import { createSignUpHandler } from '../auth-signup';
import { createClaudeConnectionHandler } from '../claude-connection';
import { createCompletionHandler } from '../completion';
import { createDashboardHandler } from '../dashboard';
import { createExportHandler } from '../data-export';
import { createDeadlineHandler } from '../deadline';
import { createDeadlinesHandler } from '../deadlines';
import { healthHandler } from '../health';
import { createKeepaliveHandler } from '../keepalive';
import { createMcpFunction } from '../mcp';
import { createNodeMoveHandler } from '../node-move';
import { createNodeStatusHandler } from '../node-status';
import { createNodeHandler } from '../node';
import { createPublicShareHandler } from '../public-share';
import { createNodesHandler } from '../nodes';
import { createRecentNodesHandler } from '../recent-nodes';
import { createReportsHandler } from '../reports';
import { createScoreHandler } from '../score';
import { createScoresHandler } from '../scores';
import { createSessionHandler } from '../session';
import { createSessionsHandler } from '../sessions';
import { createSettingsHandler } from '../settings';
import { createShareHandler } from '../share';
import { createSharesHandler } from '../shares';
import { createTaskCompleteHandler } from '../task-complete';
import { createTaskHandler } from '../task';
import { createTasksHandler } from '../tasks';
import { wellKnownHandler } from '../well-known';
import { createTrackHandler } from '../track';

// Dispatches every server request on Vercel. Netlify routed by the `config.path` export in each
// function file; Vercel runs ONE entry (`api/server.ts`), so the table lives here instead. The
// patterns and method lists are exactly the old `config.path`/`method` exports, so the public
// behavior (params, method rejection, unknown /api 404s) is identical (OPS-4).

interface Route {
  /** Netlify-style pattern from the old `config.path`, e.g. `/api/nodes/:id`. */
  path: string;
  /** Methods Netlify accepted for this path; undefined = any (only /mcp and /.well-known). */
  method?: string | readonly string[];
  handle: RequestHandler;
}

const notFound: ResponseInit = {
  status: 404,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
};

/** `:name` captures one path segment; a trailing `*` matches the rest (also nothing). */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  const wildcard = patternParts.at(-1) === '*';
  if (
    wildcard ? pathParts.length < patternParts.length - 1 : pathParts.length !== patternParts.length
  ) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    if (part === undefined) break;
    if (part === '*') return params;
    const segment = pathParts[i];
    if (part.startsWith(':')) {
      // A captured segment must be non-empty ('/api/nodes/' is not '/api/nodes/:id').
      if (!segment) return null;
      params[part.slice(1)] = segment;
    } else if (part !== segment) {
      // Includes the empty first segment of every absolute path.
      return null;
    }
  }
  return params;
}

function methodNotAllowed(allowed: readonly string[]): Response {
  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: allowed.join(', '), 'Cache-Control': 'no-store' },
  });
}

function buildRoutes(getDeps: () => ServerDeps): Route[] {
  return [
    // Trivial handlers first; they were the only functions without a `create…Handler` factory.
    { path: '/api/health', method: 'GET', handle: async () => healthHandler() },
    { path: '/.well-known/*', handle: async () => wellKnownHandler() },
    { path: '/api/keepalive', method: 'GET', handle: createKeepaliveHandler(getDeps) },
    {
      path: '/api/claude-connection',
      method: ['GET', 'POST'],
      handle: createClaudeConnectionHandler(getDeps),
    },
    { path: '/mcp/:secret', handle: createMcpFunction(getDeps) },
    { path: '/auth/confirm', method: 'GET', handle: createConfirmHandler(getDeps) },
    { path: '/api/auth/login', method: 'POST', handle: createLoginHandler(getDeps) },
    { path: '/api/auth/signup', method: 'POST', handle: createSignUpHandler(getDeps) },
    { path: '/api/auth/resend', method: 'POST', handle: createResendHandler(getDeps) },
    { path: '/api/auth/forgot', method: 'POST', handle: createForgotHandler(getDeps) },
    { path: '/api/auth/logout', method: 'POST', handle: createLogoutHandler(getDeps) },
    { path: '/api/auth/me', method: 'GET', handle: createMeHandler(getDeps) },
    { path: '/api/auth/account', method: 'DELETE', handle: createAccountHandler(getDeps) },
    { path: '/api/auth/password', method: 'POST', handle: createPasswordHandler(getDeps) },
    { path: '/api/dashboard', method: 'GET', handle: createDashboardHandler(getDeps) },
    { path: '/api/export', method: 'POST', handle: createExportHandler(getDeps) },
    { path: '/api/deadlines', method: ['GET', 'POST'], handle: createDeadlinesHandler(getDeps) },
    {
      path: '/api/deadlines/:id',
      method: ['PATCH', 'DELETE'],
      handle: createDeadlineHandler(getDeps),
    },
    { path: '/api/nodes/:id/move', method: 'POST', handle: createNodeMoveHandler(getDeps) },
    { path: '/api/nodes/:id/status', method: 'POST', handle: createNodeStatusHandler(getDeps) },
    { path: '/api/nodes/:id', method: ['PATCH', 'DELETE'], handle: createNodeHandler(getDeps) },
    { path: '/api/nodes', method: ['GET', 'POST'], handle: createNodesHandler(getDeps) },
    { path: '/api/recent-nodes', method: 'GET', handle: createRecentNodesHandler(getDeps) },
    { path: '/api/completions/:id', method: 'DELETE', handle: createCompletionHandler(getDeps) },
    { path: '/api/sessions', method: ['GET', 'POST'], handle: createSessionsHandler(getDeps) },
    {
      path: '/api/sessions/:id',
      method: ['PATCH', 'DELETE'],
      handle: createSessionHandler(getDeps),
    },
    { path: '/api/settings', method: ['GET', 'PATCH'], handle: createSettingsHandler(getDeps) },
    { path: '/api/scores', method: ['GET', 'POST'], handle: createScoresHandler(getDeps) },
    { path: '/api/scores/:id', method: ['PATCH', 'DELETE'], handle: createScoreHandler(getDeps) },
    { path: '/api/tasks', method: ['GET', 'POST'], handle: createTasksHandler(getDeps) },
    { path: '/api/tasks/:id/complete', method: 'POST', handle: createTaskCompleteHandler(getDeps) },
    { path: '/api/tasks/:id', method: ['PATCH', 'DELETE'], handle: createTaskHandler(getDeps) },
    { path: '/api/tracks/:id', method: 'GET', handle: createTrackHandler(getDeps) },
    { path: '/api/reports', method: 'POST', handle: createReportsHandler(getDeps) },
    { path: '/api/shares', method: ['GET', 'POST'], handle: createSharesHandler(getDeps) },
    { path: '/api/shares/:id', method: 'DELETE', handle: createShareHandler(getDeps) },
    { path: '/api/share/:slug', method: 'GET', handle: createPublicShareHandler(getDeps) },
  ];
}

export function createDispatcher(
  getDeps: () => ServerDeps,
): (request: Request, ip: string) => Promise<Response> {
  const routes = buildRoutes(getDeps);
  return async (request, ip) => {
    const { pathname } = new URL(request.url);
    for (const route of routes) {
      const params = matchPath(route.path, pathname);
      if (!params) continue;
      if (route.method) {
        const allowed = Array.isArray(route.method) ? route.method : [route.method];
        if (!allowed.includes(request.method)) return methodNotAllowed(allowed);
      }
      return route.handle(request, { ip, params });
    }
    // The rewrites cover /api/*, /auth/*, /mcp/* and /.well-known/*, so an unmatched request with
    // one of those prefixes asked for a route that doesn't exist. Serve the same plain 404 the
    // platform did (responds the same for unknown and known-shaped wrong paths, per SHARE-2/D19).
    return new Response('Not found', notFound);
  };
}
