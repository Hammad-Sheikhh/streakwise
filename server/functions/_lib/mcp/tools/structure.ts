import { nodePath } from '../../../../../src/core/logic/tree.js';
import type { UpdateNodeInput } from '../../../../../src/core/schemas/inputs.js';
import {
  addNodeToolSchema,
  archiveNodeToolSchema,
  findGapsToolSchema,
  getProgressToolSchema,
  getReportToolSchema,
  getStructureToolSchema,
  listDeadlinesToolSchema,
  setTopicStatusToolSchema,
  unarchiveNodeToolSchema,
  updateNodeToolSchema,
} from '../../../../../src/core/schemas/mcp.js';
import { upcomingDeadlines } from '../../../../../src/core/services/deadlines.js';
import { findGaps, getProgress } from '../../../../../src/core/services/insights.js';
import { buildReport } from '../../../../../src/core/services/reports.js';
import {
  addNode,
  listTree,
  setTopicStatus,
  updateNode,
} from '../../../../../src/core/services/structure.js';
import { cap, READ_ONLY, WRITE } from '../tool.js';
import type { ToolContext } from '../tool.js';
import { KIND, nodeView, pathOf, structure } from '../views.js';

// The tree, progress, gaps, deadlines, and reports (MCP-9), plus renaming, weekly targets, and
// archiving (MCP-18).

export function registerStructureTools(ctx: ToolContext): void {
  const { server, run } = ctx;
  const { repo, clock, newId } = ctx.deps;

  server.registerTool(
    'get_structure',
    {
      title: 'Get structure',
      description:
        'Returns the study tree (tracks > subtasks > topics) with ids, kinds, weekly targets ' +
        '(minutes, tracks only), and topic statuses. Call this first to learn the names and ids ' +
        'to use in other tools.',
      inputSchema: getStructureToolSchema,
      annotations: READ_ONLY,
    },
    ({ include_archived }) =>
      run('get_structure', async () => ({
        tracks: structure(await listTree(repo), include_archived),
      })),
  );

  server.registerTool(
    'add_node',
    {
      title: 'Add a subtask or topic',
      description:
        'Creates a subtask under a track, or a topic under a subtask. Names must be unique ' +
        'among siblings. New topics start as not_started. Returns the new node with its id.',
      inputSchema: addNodeToolSchema,
      annotations: WRITE,
    },
    ({ parent, name }) =>
      run('add_node', async () => {
        const nodes = await repo.listNodes();
        const parentNode = ctx.node(nodes, parent);
        const created = await addNode(repo, newId, { parentId: parentNode.id, name });
        return {
          node: {
            id: created.id,
            name: created.name,
            kind: KIND[created.depth],
            path: [...nodePath(nodes, parentNode.id), created.name].join(' > '),
            status: created.topicStatus ?? undefined,
          },
        };
      }),
  );

  server.registerTool(
    'update_node',
    {
      title: 'Rename a node or set a weekly target',
      description:
        'Renames a track, subtask, or topic (unique among its siblings), and/or sets a track’s ' +
        'weekly target in minutes (half-hour steps; null removes it). Returns the node.',
      inputSchema: updateNodeToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ node, name, weekly_target }) =>
      run('update_node', async () => {
        const target = ctx.node(await repo.listNodes(), node);
        const input: UpdateNodeInput = {};
        if (name !== undefined) input.name = name;
        if (weekly_target !== undefined) input.weeklyTargetMinutes = weekly_target;
        const updated = await updateNode(repo, clock, target.id, input);
        return { node: nodeView(await repo.listNodes(), updated) };
      }),
  );

  server.registerTool(
    'archive_node',
    {
      title: 'Archive a node',
      description:
        'Hides a track, subtask, or topic and everything under it from the app, lists, and ' +
        'warnings; its history still counts in reports. Nothing is deleted. Returns the node.',
      inputSchema: archiveNodeToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ node }) =>
      run('archive_node', async () => {
        const target = ctx.node(await repo.listNodes(), node);
        const updated = await updateNode(repo, clock, target.id, { archived: true });
        return { node: nodeView(await repo.listNodes(), updated) };
      }),
  );

  server.registerTool(
    'unarchive_node',
    {
      title: 'Restore an archived node',
      description:
        'Brings back an archived track, subtask, or topic with everything under it. Archived ' +
        'nodes are found by name too (see get_structure with include_archived). Returns the node.',
      inputSchema: unarchiveNodeToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ node }) =>
      run('unarchive_node', async () => {
        const target = ctx.node(await repo.listNodes(), node, { preferArchived: true });
        const updated = await updateNode(repo, clock, target.id, { archived: false });
        return { node: nodeView(await repo.listNodes(), updated) };
      }),
  );

  server.registerTool(
    'set_topic_status',
    {
      title: 'Set a topic’s status',
      description:
        'Sets a topic (level 3) to not_started, in_progress, or done; a done topic can be ' +
        'reopened. Syllabus % counts done topics. Returns the topic.',
      inputSchema: setTopicStatusToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    ({ topic, status }) =>
      run('set_topic_status', async () => {
        const nodes = await repo.listNodes();
        const target = ctx.node(nodes, topic);
        const updated = await setTopicStatus(repo, clock, target.id, { status });
        return {
          topic: { id: updated.id, path: pathOf(nodes, updated.id), status: updated.topicStatus },
        };
      }),
  );

  server.registerTool(
    'get_progress',
    {
      title: 'Get progress',
      description:
        'This week’s minutes per track and subtask against weekly targets (with a behind-pace ' +
        'flag), today’s minutes, the current and longest streak in days, syllabus % (done ' +
        'topics ÷ topics; null when a node has no topics), and upcoming deadlines with days left.',
      inputSchema: getProgressToolSchema,
      annotations: READ_ONLY,
    },
    () => run('get_progress', () => getProgress(repo, clock)),
  );

  server.registerTool(
    'find_gaps',
    {
      title: 'Find gaps',
      description:
        'What needs attention: tracks and subtasks not studied for at least the neglect ' +
        'threshold (in days), tracks behind pace on their weekly target, topics not started ' +
        'yet, and tasks due this week (overdue first). "truncated" is true when any list was ' +
        'cut to the limit.',
      inputSchema: findGapsToolSchema,
      annotations: READ_ONLY,
    },
    ({ limit }) =>
      run('find_gaps', async () => {
        const gaps = await findGaps(repo, clock);
        const neglected = cap(gaps.neglected, limit);
        const behindPace = cap(gaps.behindPace, limit);
        const topics = cap(gaps.topicsNotStarted, limit);
        const tasks = cap(gaps.tasksDue, limit);
        return {
          ...gaps,
          neglected: neglected.items,
          behindPace: behindPace.items,
          topicsNotStarted: topics.items,
          tasksDue: tasks.items,
          truncated:
            neglected.truncated || behindPace.truncated || topics.truncated || tasks.truncated,
        };
      }),
  );

  server.registerTool(
    'list_deadlines',
    {
      title: 'List deadlines',
      description:
        'Deadlines (exams, submissions) by due date, with days left, whether it is marked as an ' +
        'exam, and the share of the node’s syllabus not yet done (null when it has no topics). ' +
        'Upcoming only by default.',
      inputSchema: listDeadlinesToolSchema,
      annotations: READ_ONLY,
    },
    ({ include_past, limit }) =>
      run('list_deadlines', async () => {
        const [nodes, deadlines] = await Promise.all([
          repo.listNodes(),
          upcomingDeadlines(repo, clock, { includePast: include_past }),
        ]);
        const page = cap(deadlines, limit);
        return {
          today: ctx.today,
          deadlines: page.items.map((d) => ({
            id: d.id,
            title: d.title,
            dueOn: d.dueOn,
            daysLeft: d.daysLeft,
            nodeId: d.nodeId,
            path: pathOf(nodes, d.nodeId),
            syllabusLeftPercent: d.syllabusLeftPercent,
            isExam: d.isExam,
          })),
          truncated: page.truncated,
        };
      }),
  );

  server.registerTool(
    'get_report',
    {
      title: 'Get a study report',
      description:
        'A summary of one period: totals (time, sessions, active days, streak), time per track ' +
        'and subtask with % of the weekly target (week periods), topics studied and marked done, ' +
        'tasks completed with scores, scores recorded, neglected nodes at the end of the period, ' +
        'and the next 3 deadlines. Durations are minutes. The same data as the app’s Reports screen.',
      inputSchema: getReportToolSchema,
      annotations: READ_ONLY,
    },
    ({ period, from, to, include_notes }) =>
      run('get_report', async () =>
        buildReport(repo, clock, {
          period,
          from: ctx.optionalDate(from),
          to: ctx.optionalDate(to),
          includeNotes: include_notes,
        }),
      ),
  );
}
