import { notFound } from '../../../../../src/core/domain/errors.js';
import { subtreeIds } from '../../../../../src/core/logic/tree.js';
import {
  deleteScoreToolSchema,
  listScoresToolSchema,
  logScoreToolSchema,
  updateScoreToolSchema,
} from '../../../../../src/core/schemas/mcp.js';
import {
  addScore,
  deleteScore,
  findScores,
  updateScore,
} from '../../../../../src/core/services/scores.js';
import { DELETE, READ_ONLY, WRITE } from '../tool.js';
import type { ToolContext } from '../tool.js';
import { scoreView } from '../views.js';

// Scores: record, find, edit, and delete (MCP-9, MCP-18).

export function registerScoreTools(ctx: ToolContext): void {
  const { server, run } = ctx;
  const { repo, clock, newId } = ctx.deps;

  server.registerTool(
    'log_score',
    {
      title: 'Record a score',
      description:
        'Records a result (past paper, quiz, mock test, revision test, or other) on a node: ' +
        'score out of max_score, dated today unless given. Returns the score with its percent.',
      inputSchema: logScoreToolSchema,
      annotations: WRITE,
    },
    (input) =>
      run('log_score', async () => {
        const nodes = await repo.listNodes();
        const target = ctx.node(nodes, input.node);
        const saved = await addScore(repo, clock, newId, {
          nodeId: target.id,
          kind: input.kind,
          title: input.title,
          takenOn: ctx.date(input.date),
          score: input.score,
          maxScore: input.max_score,
          note: input.note ?? null,
        });
        return { score: scoreView(nodes, saved) };
      }),
  );

  server.registerTool(
    'list_scores',
    {
      title: 'List scores',
      description:
        'Scores newest first, optionally for one node (including everything under it), a date ' +
        'range, a kind, and text in the title. "fromTask": true marks scores recorded by ' +
        'completing a task (untick the task to remove one of those with its completion).',
      inputSchema: listScoresToolSchema,
      annotations: READ_ONLY,
    },
    ({ node, from, to, kind, title_contains, limit }) =>
      run('list_scores', async () => {
        const nodes = await repo.listNodes();
        const page = await findScores(repo, {
          nodeIds: node === undefined ? undefined : subtreeIds(nodes, ctx.node(nodes, node).id),
          from: ctx.optionalDate(from),
          to: ctx.optionalDate(to),
          kind,
          titleContains: title_contains,
          limit,
        });
        return {
          scores: page.scores.map((s) => ({
            ...scoreView(nodes, s),
            fromTask: s.taskCompletionId !== null ? true : undefined,
          })),
          truncated: page.truncated,
        };
      }),
  );

  server.registerTool(
    'update_score',
    {
      title: 'Edit a score',
      description:
        'Changes a score’s points, maximum, title, note (null removes it), date (not in the ' +
        'future), or kind. Scores of any date can be edited. Returns the score as it is now.',
      inputSchema: updateScoreToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    (input) =>
      run('update_score', async () => {
        const saved = await updateScore(repo, clock, input.score_id, {
          score: input.score,
          maxScore: input.max_score,
          title: input.title,
          note: input.note,
          takenOn: ctx.optionalDate(input.date),
          kind: input.kind,
        });
        return { score: scoreView(await repo.listNodes(), saved) };
      }),
  );

  server.registerTool(
    'delete_score',
    {
      title: 'Delete a score',
      description:
        'Deletes one score by id (from list_scores or log_score). A task it came from stays ' +
        'completed. Confirm with the student first; they can undo it in the app’s Recent ' +
        'changes. Returns the deleted score.',
      inputSchema: deleteScoreToolSchema,
      annotations: DELETE,
    },
    ({ score_id }) =>
      run('delete_score', async () => {
        const score = (await repo.listScores()).find((s) => s.id === score_id);
        if (!score) throw notFound('score_not_found');
        await deleteScore(repo, score_id);
        return { deleted: scoreView(await repo.listNodes(), score) };
      }),
  );
}
