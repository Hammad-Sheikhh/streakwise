import { createHash, timingSafeEqual } from 'node:crypto';

import type { Config } from '@netlify/functions';
import { createMcpHandler } from '@modelcontextprotocol/server';

import type { NetlifyHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { ConfigError } from './_lib/env';
import { describeError, log } from './_lib/log';
import { buildMcpServer } from './_lib/mcp/server';

// MCP-1/MCP-2: the Claude connection at /mcp/<MCP_SECRET>, stateless Streamable HTTP. The secret in
// the URL is the only credential, so anything that doesn't match gets the same plain 404 as an
// unknown page.

/** Shorter secrets are treated as not configured: the URL must be impossible to guess. */
export const MIN_MCP_SECRET_LENGTH = 32;

/** Constant-time comparison: both sides are hashed to equal-length digests first. */
export function mcpSecretMatches(given: string, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_MCP_SECRET_LENGTH) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function notFoundResponse(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function createMcpFunction(getDeps: () => ServerDeps): NetlifyHandler {
  // The handler keeps no data between requests: the factory builds a fresh server for each one.
  // Responses are plain JSON because no tool sends progress messages.
  const mcp = createMcpHandler(() => buildMcpServer(getDeps()), {
    onerror: (error) => log.warn('mcp_protocol_error', describeError(error)),
  });

  return async (request, context) => {
    try {
      const expected = getDeps().env.MCP_SECRET;
      if (!mcpSecretMatches(context.params?.secret ?? '', expected)) {
        if (!expected || expected.length < MIN_MCP_SECRET_LENGTH) {
          log.warn('mcp_not_configured', { variables: ['MCP_SECRET'] });
        }
        return notFoundResponse();
      }
      // Netlify's guidance: a serverless function can't hold open the GET event stream.
      if (request.method !== 'POST') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
        });
      }
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
