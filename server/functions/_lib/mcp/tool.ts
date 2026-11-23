import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';

import { DomainError } from '../../../../src/core/domain/errors.js';
import type { TreeNode } from '../../../../src/core/domain/types.js';
import { resolveDateRef } from '../../../../src/core/logic/dateRef.js';
import { resolveNodeRef } from '../../../../src/core/logic/nodeRef.js';
import type { UserDeps } from '../deps.js';
import { describeError, log } from '../log.js';

// What every Claude tool shares: the result and error shapes, annotations, and the request's
// "today" (the study day, DAY-2), read once per request.

export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/** MCP-12: deletes are destructive; the instructions say to confirm with the student first. */
export const DELETE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function result(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function failure(
  code: string,
  message: string,
  details: Record<string, string | number> = {},
): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: { code, message, ...details } }) }],
    isError: true,
  };
}

export function cap<T>(items: readonly T[], limit: number): { items: T[]; truncated: boolean } {
  return { items: items.slice(0, limit), truncated: items.length > limit };
}

export interface ToolContext {
  server: McpServer;
  deps: UserDeps;
  /** Runs one tool call: JSON on success, `{ error }` on failure, and the "last call" stamp. */
  run: (tool: string, work: () => Promise<unknown>) => Promise<CallToolResult>;
  /** Today's study day under the user's setting. */
  today: string;
  /** Resolves "today", "yesterday", or YYYY-MM-DD against the study day (MCP-6, MCP-22). */
  date: (ref: string) => string;
  /** Optional date references stay undefined. */
  optionalDate: (ref: string | undefined) => string | undefined;
  node: (
    nodes: readonly TreeNode[],
    ref: string,
    options?: { preferArchived?: boolean },
  ) => TreeNode;
}

export function toolContext(server: McpServer, deps: UserDeps, today: string): ToolContext {
  const { repo, clock } = deps;
  const run = async (tool: string, work: () => Promise<unknown>): Promise<CallToolResult> => {
    const started = Date.now();
    let outcome: CallToolResult;
    try {
      outcome = result(await work());
    } catch (error) {
      if (error instanceof DomainError) {
        outcome = failure(error.code, error.message, error.details);
      } else {
        log.error('mcp_tool_failed', { tool, ...describeError(error) });
        outcome = failure('internal', 'Something went wrong. Please try again.');
      }
    }
    try {
      await repo.recordMcpCall(clock().toISOString());
    } catch (error) {
      log.warn('mcp_record_call_failed', describeError(error));
    }
    log.info('mcp_tool', { tool, ok: !outcome.isError, ms: Date.now() - started });
    return outcome;
  };
  const date = (ref: string) => resolveDateRef(ref, today);
  return {
    server,
    deps,
    run,
    today,
    date,
    optionalDate: (ref) => (ref === undefined ? undefined : date(ref)),
    node: (nodes, ref, options) => resolveNodeRef(nodes, ref, options),
  };
}
