import type { Config } from '@netlify/functions';

import type { ClaudeConnection } from '../../src/core/domain/types';
import { apiHandler, byMethod } from './_lib/api';
import type { ApiRequest } from './_lib/api';
import { serverDeps } from './_lib/deps';
import type { ServerDeps } from './_lib/deps';
import { json } from './_lib/http';
import { log } from './_lib/log';
import { generateMcpToken, hashMcpToken } from './_lib/mcpToken';

// SET-4, ACCT-8: the user's own Claude link. Only a hash is stored, so the link itself is shown
// once, in the answer to POST (which also replaces any older link). GET says whether one exists.

async function connection({ deps }: ApiRequest, url: string | null): Promise<ClaudeConnection> {
  return {
    url,
    hasLink: url !== null || (await deps.accounts.hasMcpToken(deps.userId)),
    lastMcpCallAt: (await deps.repo.getSettings()).lastMcpCallAt,
  };
}

export function createClaudeConnectionHandler(getDeps: () => ServerDeps) {
  return apiHandler(
    { route: 'claude-connection', auth: true },
    getDeps,
    byMethod<ApiRequest>({
      GET: async (input) => json(await connection(input, null)),
      POST: async (input) => {
        const token = generateMcpToken();
        await input.deps.accounts.setMcpTokenHash(input.deps.userId, hashMcpToken(token));
        log.info('mcp_link_created', {});
        // The origin comes from the request, so a deploy preview shows its own URL.
        const url = `${new URL(input.request.url).origin}/mcp/${token}`;
        return json(await connection(input, url), { status: 201 });
      },
    }),
  );
}

export default createClaudeConnectionHandler(serverDeps);

export const config: Config = {
  path: '/api/claude-connection',
  method: ['GET', 'POST'],
};
