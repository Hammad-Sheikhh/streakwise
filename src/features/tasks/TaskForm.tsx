import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TreeNode } from '@/core/domain/types';
import { hiddenIds } from '@/core/logic/tree';

import type { TaskValues } from './taskValues';

// TASK-2: title, optional description, node, either an optional due date or weekly recurrence,
// and a scored switch with a default maximum.
export function TaskForm({
  nodes,
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  nodes: readonly TreeNode[];
  initial: TaskValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: TaskValues) => void;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const hidden = hiddenIds(nodes);
  const options = nodes.filter((n) => !hidden.has(n.id) || n.id === initial.nodeId);
  const max = Number(values.defaultMaxScore);
  const errors = {
    title: values.title.trim() ? null : 'Enter a title.',
    nodeId: values.nodeId ? null : 'Choose what it’s for.',
    defaultMaxScore:
      !values.isScored || (values.defaultMaxScore.trim() !== '' && max > 0)
        ? null
        : 'Enter the usual maximum score.',
  };
  type Field = keyof typeof errors;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit(values);
  }

  const set = (patch: Partial<TaskValues>) => setValues({ ...values, ...patch });
  const field = (key: Field) =>
    submitted && errors[key]
      ? { 'aria-invalid': true, 'aria-describedby': `${id}-${key}-error` }
      : {};
  const error = (key: Field) =>
    submitted &&
    errors[key] && (
      <p id={`${id}-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    );

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          className="h-11"
          maxLength={120}
          placeholder="e.g. Past paper 2023"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          {...field('title')}
        />
        {error('title')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-description`}>Description (optional)</Label>
        <Textarea
          id={`${id}-description`}
          maxLength={2000}
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-node`}>For</Label>
        <NativeSelect
          id={`${id}-node`}
          value={values.nodeId}
          onChange={(e) => set({ nodeId: e.target.value })}
          {...field('nodeId')}
        >
          <option value="">Choose…</option>
          {options.map((n) => (
            <option key={n.id} value={n.id}>
              {'  '.repeat(n.depth - 1)}
              {n.name}
            </option>
          ))}
        </NativeSelect>
        {error('nodeId')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-repeat`}>Repeats</Label>
          <NativeSelect
            id={`${id}-repeat`}
            value={values.recurrence}
            onChange={(e) => set({ recurrence: e.target.value === 'weekly' ? 'weekly' : 'none' })}
          >
            <option value="none">Once</option>
            <option value="weekly">Every week</option>
          </NativeSelect>
        </div>
        {values.recurrence === 'none' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-due`}>Due date (optional)</Label>
            <Input
              id={`${id}-due`}
              type="date"
              className="h-11"
              value={values.dueOn}
              onChange={(e) => set({ dueOn: e.target.value })}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-scored`}
          type="checkbox"
          className="size-5 accent-primary"
          checked={values.isScored}
          onChange={(e) => set({ isScored: e.target.checked })}
        />
        <Label htmlFor={`${id}-scored`}>Record a score when it’s done</Label>
      </div>
      {values.isScored && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-max`}>Usual maximum score</Label>
          <Input
            id={`${id}-max`}
            className="h-11 max-w-40"
            inputMode="decimal"
            value={values.defaultMaxScore}
            onChange={(e) => set({ defaultMaxScore: e.target.value })}
            {...field('defaultMaxScore')}
          />
          {error('defaultMaxScore')}
        </div>
      )}
      <Button type="submit" className="h-11 self-start" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
