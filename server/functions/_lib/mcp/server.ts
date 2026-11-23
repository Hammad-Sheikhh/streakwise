import { McpServer } from '@modelcontextprotocol/server';

import { studyDate } from '../../../../src/core/logic/dates.js';
import type { UserDeps } from '../deps.js';
import { mcpInstructions } from './instructions.js';
import { toolContext } from './tool.js';
import { registerMistakeTools } from './tools/mistakes.js';
import { registerScoreTools } from './tools/scores.js';
import { registerSessionTools } from './tools/sessions.js';
import { registerStructureTools } from './tools/structure.js';
import { registerTaskTools } from './tools/tasks.js';

// MCP-2–24: the Claude connection. A fresh server is built for every request (stateless), and every
// tool is a thin wrapper around the core services that returns compact JSON text. Claude's writes
// go through a repository that records them as coming from Claude (MCP-24, see forUser).

export const MCP_SERVER_NAME = 'streakwise';
export const MCP_SERVER_VERSION = '1.1.0';

/**
 * Builds the server for one request, for the user whose link was used (ACCT-8). `dayEndsAtMinutes`
 * is the user's "My day ends at" setting, read once for the request (DAY-2, MCP-22). Each tool
 * call also stamps that user's "last MCP call" time.
 */
export function buildMcpServer(deps: UserDeps, dayEndsAtMinutes = 0): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: mcpInstructions(dayEndsAtMinutes) },
  );
  const ctx = toolContext(server, deps, studyDate(deps.clock(), dayEndsAtMinutes));
  registerStructureTools(ctx);
  registerSessionTools(ctx);
  registerTaskTools(ctx);
  registerScoreTools(ctx);
  registerMistakeTools(ctx);
  return server;
}
