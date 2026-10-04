import type { Config } from '@netlify/functions';

import type { ClaudeConnection } from '../../src/core/domain/types';
import { apiHandler } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';
import { isMcpConfigured } from './_lib/mcpSecret';

// SET-4: the connector URL for Settings (logged-in owner only) and when Claude last called.
// The origin comes from the request, so a deploy preview shows its own URL.
export function createClaudeConnectionHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'claude-connection', auth: true },
    getDeps,
    async ({ request, deps }) => {
      const secret = deps.env.MCP_SECRET;
      const body: ClaudeConnection = {
        url: isMcpConfigured(secret)
          ? `${new URL(request.url).origin}/mcp/${encodeURIComponent(secret)}`
          : null,
        lastMcpCallAt: (await deps.repo.getSettings()).lastMcpCallAt,
      };
      return json(body);
    },
  );
}

export default createClaudeConnectionHandler(serverDeps);

export const config: Config = {
  path: '/api/claude-connection',
  method: 'GET',
};
