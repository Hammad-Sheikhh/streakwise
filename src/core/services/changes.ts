import { z } from 'zod';

import { conflict, DomainError, notFound } from '../domain/errors.js';
import type { ChangeEntry, Clock } from '../domain/types.js';
import { changedFields, withoutRecording } from '../repo/RecordingRepository.js';
import type { Repository } from '../repo/Repository.js';
import {
  deadlineSchema,
  mistakeSchema,
  scoreSchema,
  sessionSchema,
  taskCompletionSchema,
  taskSchema,
  treeNodeSchema,
} from '../schemas/domain.js';

// UNDO-4–6: the Recent changes list and undo. Undo is the inverse of the recorded change
// (UNDO-5), works on the store underneath (so it isn't recorded and can't be redone), and refuses
// when a later change to the same item hasn't been undone or the item can't be put back.

/** UNDO-4: the list covers this many days. */
export const RECENT_CHANGES_DAYS = 7;
/** A ceiling for one list, far above a week of normal use. */
export const MAX_RECENT_CHANGES = 500;

const DAY_MS = 86_400_000;

/** UNDO-4: the last 7 days, newest first. */
export async function listRecentChanges(repo: Repository, clock: Clock): Promise<ChangeEntry[]> {
  const since = new Date(clock().getTime() - RECENT_CHANGES_DAYS * DAY_MS).toISOString();
  return repo.listChanges({ since, limit: MAX_RECENT_CHANGES });
}

const completionSnapshotSchema = z.object({
  completion: taskCompletionSchema,
  score: scoreSchema.nullable(),
  taskTitle: z.string(),
});

const taskTreeSnapshotSchema = z.object({
  tasks: z.array(taskSchema).min(1),
  completions: z.array(taskCompletionSchema),
  scoreLinks: z.array(z.object({ scoreId: z.uuid(), completionId: z.uuid() })),
});

const nodeTreeSnapshotSchema = z.object({ nodes: z.array(treeNodeSchema).min(1) });

function cannotUndo(message?: string): DomainError {
  return message ? new DomainError('conflict', 'cannot_undo', message) : conflict('cannot_undo');
}

/** Reads a snapshot back; anything unexpected means the entry can't be undone. */
function snapshot<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw cannotUndo();
  return parsed.data;
}

/** The before-state of the fields the change touched, limited to the ones the store can set. */
function restorePatch<T extends object, K extends keyof T>(
  before: T,
  after: T,
  allowed: readonly K[],
): Pick<T, K> {
  const changed = new Set(changedFields(before, after));
  const patch = {} as Pick<T, K>;
  for (const key of allowed) if (changed.has(String(key))) patch[key] = before[key];
  return patch;
}

/** Puts things back as they were before `entry`. */
async function invert(repo: Repository, entry: ChangeEntry): Promise<void> {
  const { entity, action, entityId: id } = entry;

  if (entity === 'session') {
    if (action === 'create') return repo.deleteSession(id);
    const before = snapshot(sessionSchema, entry.before);
    if (action === 'delete') {
      const { id: sessionId, nodeId, studiedOn, minutes, note, source, createdAt } = before;
      await repo.insertSession({
        id: sessionId,
        nodeId,
        studiedOn,
        minutes,
        note,
        source,
        createdAt,
      });
      return;
    }
    const after = snapshot(sessionSchema, entry.after);
    await repo.updateSession(
      id,
      restorePatch(before, after, ['nodeId', 'studiedOn', 'minutes', 'note']),
    );
    return;
  }

  if (entity === 'score') {
    if (action === 'create') return repo.deleteScore(id);
    const before = snapshot(scoreSchema, entry.before);
    if (action === 'delete') {
      // Relink to the completion only if it still exists.
      const completions = await repo.listTaskCompletions();
      const link = before.taskCompletionId;
      await repo.insertScore({
        ...before,
        taskCompletionId: link !== null && completions.some((c) => c.id === link) ? link : null,
      });
      return;
    }
    const after = snapshot(scoreSchema, entry.after);
    await repo.updateScore(
      id,
      restorePatch(before, after, [
        'nodeId',
        'kind',
        'title',
        'takenOn',
        'score',
        'maxScore',
        'note',
      ]),
    );
    return;
  }

  if (entity === 'task') {
    if (action === 'create') {
      const [tasks, completions] = await Promise.all([
        repo.listTasks(),
        repo.listTaskCompletions(),
      ]);
      if (tasks.some((t) => t.parentTaskId === id) || completions.some((c) => c.taskId === id)) {
        throw cannotUndo('This task has sub-tasks or ticks now. Delete it instead.');
      }
      return repo.deleteTask(id);
    }
    if (action === 'delete')
      return repo.restoreTaskTree(snapshot(taskTreeSnapshotSchema, entry.before));
    const before = snapshot(taskSchema, entry.before);
    const after = snapshot(taskSchema, entry.after);
    await repo.updateTask(
      id,
      restorePatch(before, after, [
        'nodeId',
        'title',
        'description',
        'dueOn',
        'recurrence',
        'isScored',
        'defaultMaxScore',
        'sortOrder',
        'archivedAt',
      ]),
    );
    return;
  }

  if (entity === 'completion') {
    if (action === 'complete') {
      const { completion } = snapshot(completionSnapshotSchema, entry.after);
      // Removes the score it recorded too, atomically.
      return repo.uncompleteTask(completion.id);
    }
    if (action === 'uncomplete') {
      const { completion, score } = snapshot(completionSnapshotSchema, entry.before);
      await repo.completeTask({
        id: completion.id,
        taskId: completion.taskId,
        periodStart: completion.periodStart,
        completedAt: completion.completedAt,
        completedOn: completion.completedOn,
        note: completion.note,
        score: score && {
          id: score.id,
          nodeId: score.nodeId,
          kind: score.kind,
          title: score.title,
          takenOn: score.takenOn,
          score: score.score,
          maxScore: score.maxScore,
          note: score.note,
          createdAt: score.createdAt,
        },
      });
      return;
    }
  }

  if (entity === 'mistake') {
    if (action === 'create') return repo.deleteMistake(id);
    const before = snapshot(mistakeSchema, entry.before);
    if (action === 'delete') {
      await repo.insertMistake({ ...before });
      return;
    }
    const after = snapshot(mistakeSchema, entry.after);
    await repo.updateMistake(
      id,
      restorePatch(before, after, [
        'nodeId',
        'text',
        'status',
        'step',
        'anchorOn',
        'nextDueOn',
        'reviewCount',
        'lastReviewedOn',
        'lastResult',
        'learnedOn',
      ]),
    );
    return;
  }

  if (entity === 'node') {
    if (action === 'create') {
      if ((await repo.listNodes()).some((n) => n.parentId === id)) {
        throw cannotUndo('This has parts of its own now. Delete or archive it instead.');
      }
      try {
        await repo.deleteNodeTree(id);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'node_in_use') {
          throw cannotUndo(
            'This has history now (sessions, tasks, scores, or mistakes). Archive it instead.',
          );
        }
        throw error;
      }
      return;
    }
    if (action === 'delete')
      return repo.restoreNodes(snapshot(nodeTreeSnapshotSchema, entry.before).nodes);
    const before = snapshot(treeNodeSchema, entry.before);
    const after = snapshot(treeNodeSchema, entry.after);
    await repo.updateNode(
      id,
      restorePatch(before, after, [
        'name',
        'color',
        'sortOrder',
        'weeklyTargetMinutes',
        'topicStatus',
        'topicDoneAt',
        'archivedAt',
      ]),
    );
    return;
  }

  if (entity === 'deadline') {
    if (action === 'create') return repo.deleteDeadline(id);
    const before = snapshot(deadlineSchema, entry.before);
    if (action === 'delete') {
      await repo.insertDeadline(before);
      return;
    }
    const after = snapshot(deadlineSchema, entry.after);
    await repo.updateDeadline(
      id,
      restorePatch(before, after, ['nodeId', 'title', 'dueOn', 'isExam']),
    );
    return;
  }

  throw cannotUndo();
}

/**
 * UNDO-5: undoes one recorded change. Refuses with 409 `changed_since` when the same item has a
 * later change that isn't undone, and `cannot_undo` when it can't be put back (for example its
 * node was deleted). Returns the entry, now marked undone.
 */
export async function undoChange(repo: Repository, clock: Clock, id: string): Promise<ChangeEntry> {
  const store = withoutRecording(repo);
  const entry = await store.getChange(id);
  if (!entry) throw notFound('change_not_found');
  if (entry.undoneAt !== null) throw conflict('already_undone');
  if ((await store.laterChanges(id)).length > 0) throw conflict('changed_since');
  try {
    await invert(store, entry);
  } catch (error) {
    if (error instanceof DomainError && error.code !== 'cannot_undo') throw cannotUndo();
    throw error;
  }
  return store.markChangeUndone(id, clock().toISOString());
}
