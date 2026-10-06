import type { TaskRecurrence } from '@/core/domain/types';

/** Anything that can change a task's state; Home and the track page show tasks too. */
export const TASK_KEYS = ['tasks', 'scores', 'track'];

/** The task form's fields, as typed. */
export interface TaskValues {
  title: string;
  description: string;
  nodeId: string;
  recurrence: TaskRecurrence;
  dueOn: string;
  isScored: boolean;
  defaultMaxScore: string;
}

export const EMPTY_TASK: TaskValues = {
  title: '',
  description: '',
  nodeId: '',
  recurrence: 'none',
  dueOn: '',
  isScored: false,
  defaultMaxScore: '',
};

/** The form's values as the data source expects them. */
export function toTaskInput(values: TaskValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    nodeId: values.nodeId,
    recurrence: values.recurrence,
    dueOn: values.recurrence === 'none' && values.dueOn ? values.dueOn : null,
    isScored: values.isScored,
    defaultMaxScore: values.isScored ? Number(values.defaultMaxScore) : null,
  };
}
