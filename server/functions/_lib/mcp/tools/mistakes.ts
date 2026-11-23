import {
  addMistakeToolSchema,
  listDueMistakesToolSchema,
  reviewMistakeToolSchema,
} from '../../../../../src/core/schemas/mcp.js';
import {
  addMistake,
  listDueMistakes,
  reviewMistake,
} from '../../../../../src/core/services/mistakes.js';
import { cap, READ_ONLY, WRITE } from '../tool.js';
import type { ToolContext } from '../tool.js';
import { mistakeView } from '../views.js';

// The mistake tracker (MCP-21, ERR): save, list what's due, and review right or wrong.

export function registerMistakeTools(ctx: ToolContext): void {
  const { server, run } = ctx;
  const { repo, clock, newId } = ctx.deps;

  server.registerTool(
    'add_mistake',
    {
      title: 'Save a mistake',
      description:
        'Saves a mistake to review later, on the node it belongs to. It comes up for review 1, ' +
        '3, and 7 days after the date (default today). Returns the mistake with its id and ' +
        'first review date.',
      inputSchema: addMistakeToolSchema,
      annotations: WRITE,
    },
    ({ node, text, date }) =>
      run('add_mistake', async () => {
        const nodes = await repo.listNodes();
        const mistake = await addMistake(
          repo,
          clock,
          newId,
          { nodeId: ctx.node(nodes, node).id, text, createdOn: ctx.date(date) },
          'claude',
        );
        return { mistake: mistakeView(nodes, mistake) };
      }),
  );

  server.registerTool(
    'list_due_mistakes',
    {
      title: 'List mistakes due for review',
      description:
        'Open mistakes due on or before a day (default today), oldest due first, optionally ' +
        'for one node and everything under it. Review each with review_mistake.',
      inputSchema: listDueMistakesToolSchema,
      annotations: READ_ONLY,
    },
    ({ node, date, limit }) =>
      run('list_due_mistakes', async () => {
        const nodes = await repo.listNodes();
        const due = await listDueMistakes(repo, clock, {
          nodeId: node === undefined ? undefined : ctx.node(nodes, node).id,
          date: ctx.date(date),
        });
        const page = cap(due, limit);
        return {
          today: ctx.today,
          mistakes: page.items.map((m) => mistakeView(nodes, m)),
          truncated: page.truncated,
        };
      }),
  );

  server.registerTool(
    'review_mistake',
    {
      title: 'Review a mistake',
      description:
        'Records today’s review of a mistake. "right" moves it to the next review (+3 days, ' +
        'then +7) and marks it learned after the third; "wrong" starts again, due tomorrow. ' +
        'Returns the mistake with its new step, status, and next review date.',
      inputSchema: reviewMistakeToolSchema,
      annotations: WRITE,
    },
    ({ mistake_id, result }) =>
      run('review_mistake', async () => {
        const mistake = await reviewMistake(repo, clock, mistake_id, { result });
        return { mistake: mistakeView(await repo.listNodes(), mistake) };
      }),
  );
}
