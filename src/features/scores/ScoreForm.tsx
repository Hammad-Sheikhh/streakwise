import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SCORE_KINDS } from '@/core/domain/types';
import type { ScoreKind, TreeNode } from '@/core/domain/types';
import { hiddenIds } from '@/core/logic/tree';
import { SCORE_KIND_LABELS } from '@/lib/format';

// SCORE-1: kind, title, date (≤ today), score (≥ 0), max (> 0 and ≥ score), node, note.

export interface ScoreValues {
  kind: ScoreKind;
  title: string;
  takenOn: string;
  score: string;
  maxScore: string;
  nodeId: string;
  note: string;
}

const isKind = (value: string): value is ScoreKind =>
  (SCORE_KINDS as readonly string[]).includes(value);

export function ScoreForm({
  nodes,
  initial,
  today,
  submitLabel,
  pending,
  onSubmit,
}: {
  nodes: readonly TreeNode[];
  initial: ScoreValues;
  today: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: ScoreValues) => void;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const hidden = hiddenIds(nodes);
  const options = nodes.filter((n) => !hidden.has(n.id) || n.id === initial.nodeId);
  const score = Number(values.score);
  const max = Number(values.maxScore);
  const errors = {
    title: values.title.trim() ? null : 'Enter a title.',
    takenOn: !/^\d{4}-\d{2}-\d{2}$/.test(values.takenOn)
      ? 'Choose a date.'
      : values.takenOn > today
        ? 'The date can’t be in the future.'
        : null,
    score:
      values.score.trim() === '' || !Number.isFinite(score) || score < 0
        ? 'Enter a score of 0 or more.'
        : null,
    maxScore:
      values.maxScore.trim() === '' || !Number.isFinite(max) || max <= 0
        ? 'Enter a maximum above 0.'
        : score > max
          ? 'The score can’t be more than the maximum.'
          : null,
    nodeId: values.nodeId ? null : 'Choose what it’s for.',
  };
  type Field = keyof typeof errors;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit(values);
  }

  const set = (patch: Partial<ScoreValues>) => setValues({ ...values, ...patch });
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-kind`}>Kind</Label>
          <NativeSelect
            id={`${id}-kind`}
            value={values.kind}
            onChange={(e) => isKind(e.target.value) && set({ kind: e.target.value })}
          >
            {SCORE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SCORE_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input
            id={`${id}-date`}
            type="date"
            className="h-11"
            max={today}
            value={values.takenOn}
            onChange={(e) => set({ takenOn: e.target.value })}
            {...field('takenOn')}
          />
          {error('takenOn')}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          className="h-11"
          maxLength={120}
          placeholder="e.g. 2023 Paper 1"
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          {...field('title')}
        />
        {error('title')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-score`}>Score</Label>
          <Input
            id={`${id}-score`}
            className="h-11"
            inputMode="decimal"
            value={values.score}
            onChange={(e) => set({ score: e.target.value })}
            {...field('score')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-max`}>Out of</Label>
          <Input
            id={`${id}-max`}
            className="h-11"
            inputMode="decimal"
            value={values.maxScore}
            onChange={(e) => set({ maxScore: e.target.value })}
            {...field('maxScore')}
          />
        </div>
      </div>
      {error('score')}
      {error('maxScore')}
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
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Textarea
          id={`${id}-note`}
          maxLength={500}
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
      <Button type="submit" className="h-11 self-start" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
