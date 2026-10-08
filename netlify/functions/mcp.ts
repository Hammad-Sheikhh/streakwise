import type { Config } from '@netlify/functions';
import { createMcpHandler } from '@modelcontextprotocol/server';

import type { NetlifyHandler } from './_lib/api';
import { forUser, serverDeps } from './_lib/deps';
import type { ServerDeps, UserDeps } from './_lib/deps';
import { ConfigError } from './_lib/env';
import { describeError, log } from './_lib/log';
import { buildMcpServer } from './_lib/mcp/server';
import { hashMcpToken, isMcpTokenShaped } from './_lib/mcpToken';

// MCP-1/MCP-2, ACCT-8: the Claude connection at /mcp/<token>, stateless Streamable HTTP. Each user
// has their own token; it is the only credential, so anything that doesn't match gets the same
// plain 404 as an unknown page.

function notFoundResponse(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function createMcpFunction(getDeps: () => ServerDeps): NetlifyHandler {
  return async (request, context) => {
    try {
      const deps = getDeps();
      const token = context.params?.secret ?? '';
      const userId = isMcpTokenShaped(token)
        ? await deps.accounts.userIdForMcpTokenHash(hashMcpToken(token))
        : null;
      if (!userId) return notFoundResponse();
      // Netlify's guidance: a serverless function can't hold open the GET event stream.
      if (request.method !== 'POST') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
        });
      }
      const userDeps: UserDeps = forUser(deps, userId);
      // The handler keeps no data between requests: the factory builds a fresh server for each
      // one. Responses are plain JSON because no tool sends progress messages.
      const mcp = createMcpHandler(() => buildMcpServer(userDeps), {
        onerror: (error) => log.warn('mcp_protocol_error', describeError(error)),
      });
      return await mcp.fetch(request);
    } catch (error) {
      if (error instanceof ConfigError) {
        log.error('config_invalid', { route: 'mcp', variables: error.variables });
      } else {
        log.error('unexpected_error', { route: 'mcp', ...describeError(error) });
      }
      return new Response('Internal error', {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  };
}

export default createMcpFunction(serverDeps);

export const config: Config = {
  path: '/mcp/:secret',
};
