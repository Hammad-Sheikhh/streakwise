import type { TaskRecurrence } from '@/core/domain/types';
import type { DataSource } from '@/data/DataSource';

/** Anything that can change a task's state; Home and the track page show tasks too. */
export const TASK_KEYS = ['tasks', 'scores', 'track', 'tree'];

/** "For" choices that aren't a node: no track at all, or a track created with the task. */
export const FOR_OTHER = 'other';
export const FOR_NEW_TRACK = 'new-track';

/** The task form's fields, as typed. */
export interface TaskValues {
  title: string;
  description: string;
  /** A node id, FOR_OTHER, or FOR_NEW_TRACK. */
  nodeId: string;
  /** Used when nodeId is FOR_NEW_TRACK. */
  newTrackName: string;
  recurrence: TaskRecurrence;
  dueOn: string;
  isScored: boolean;
  defaultMaxScore: string;
}

export const EMPTY_TASK: TaskValues = {
  title: '',
  description: '',
  nodeId: '',
  newTrackName: '',
  recurrence: 'none',
  dueOn: '',
  isScored: false,
  defaultMaxScore: '',
};

/**
 * The form's values as the data source expects them. "New track" creates the track first; if the
 * task then fails to save, the new track stays (it can be renamed or deleted in Structure).
 */
export async function toTaskInput(ds: DataSource, values: TaskValues) {
  let nodeId: string | null = values.nodeId;
  if (values.nodeId === FOR_OTHER) nodeId = null;
  if (values.nodeId === FOR_NEW_TRACK) {
    nodeId = (await ds.addNode({ parentId: null, name: values.newTrackName.trim() })).id;
  }
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    nodeId,
    recurrence: values.recurrence,
    dueOn: values.recurrence === 'none' && values.dueOn ? values.dueOn : null,
    isScored: nodeId !== null && values.isScored,
    defaultMaxScore: nodeId !== null && values.isScored ? Number(values.defaultMaxScore) : null,
  };
}
