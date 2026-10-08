import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@/components/NativeSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SCORE_KINDS } from '@/core/domain/types';
import type { ScoreKind, TaskItem } from '@/core/domain/types';
import { useDataMutation } from '@/data/queries';
import { SCORE_KIND_LABELS } from '@/lib/format';

import { TASK_KEYS } from './taskValues';

// TASK-4–6: the tick box that completes a task. Scored tasks ask for the score first; uncompleting
// a scored task is confirmed, because it also deletes the score recorded with it.

export function TaskCheckbox({ item }: { item: TaskItem }) {
  const { task, completion } = item;
  const [scoring, setScoring] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const complete = useDataMutation(
    (ds, input: { score?: number; maxScore?: number; kind?: ScoreKind; note?: string }) =>
      ds.completeTask(task.id, input),
    TASK_KEYS,
    {
      onSuccess: () => {
        setScoring(false);
        toast.success(`Completed “${task.title}”.`);
      },
    },
  );
  const uncomplete = useDataMutation(
    (ds, completionId: string) => ds.uncompleteTask(completionId),
    TASK_KEYS,
  );

  function toggle() {
    if (completion) {
      if (task.isScored) setConfirming(true);
      else uncomplete.mutate(completion.id);
    } else if (task.isScored) {
      setScoring(true);
    } else {
      complete.mutate({});
    }
  }

  return (
    <>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-primary"
        aria-label={`${task.title}${task.recurrence === 'weekly' ? ' (this week)' : ''}`}
        checked={completion !== null}
        disabled={complete.isPending || uncomplete.isPending || task.archivedAt !== null}
        onChange={toggle}
      />

      {task.isScored && (
        <Dialog open={scoring} onOpenChange={setScoring}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete “{task.title}”</DialogTitle>
              <DialogDescription>Record your score. It’s saved with the task.</DialogDescription>
            </DialogHeader>
            {/* Re-mounted each time it opens, so the fields start fresh. */}
            {scoring && (
              <ScoreForm
                defaultMax={task.defaultMaxScore}
                defaultKind={task.recurrence === 'weekly' ? 'revision' : 'other'}
                pending={complete.isPending}
                onSubmit={(values) => complete.mutate(values)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark “{task.title}” as not done?</AlertDialogTitle>
            <AlertDialogDescription>
              The score recorded when you completed it will be deleted too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              variant="destructive"
              onClick={() => completion && uncomplete.mutate(completion.id)}
            >
              Mark not done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ScoreForm({
  defaultMax,
  defaultKind,
  pending,
  onSubmit,
}: {
  defaultMax: number | null;
  defaultKind: ScoreKind;
  pending: boolean;
  onSubmit: (values: { score: number; maxScore: number; kind: ScoreKind; note: string }) => void;
}) {
  const id = useId();
  const [score, setScore] = useState('');
  const [max, setMax] = useState(defaultMax === null ? '' : String(defaultMax));
  const [kind, setKind] = useState<ScoreKind>(defaultKind);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const scoreValue = Number(score);
  const maxValue = Number(max);
  const errors = {
    score:
      score.trim() === '' || !Number.isFinite(scoreValue) || scoreValue < 0
        ? 'Enter a score of 0 or more.'
        : null,
    max:
      max.trim() === '' || !Number.isFinite(maxValue) || maxValue <= 0
        ? 'Enter a maximum above 0.'
        : scoreValue > maxValue
          ? 'The score can’t be more than the maximum.'
          : null,
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.score || errors.max) return;
    onSubmit({ score: scoreValue, maxScore: maxValue, kind, note });
  }

  const invalid = (key: 'score' | 'max') =>
    submitted && errors[key]
      ? { 'aria-invalid': true, 'aria-describedby': `${id}-${key}-error` }
      : {};

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-score`}>Score</Label>
          <Input
            id={`${id}-score`}
            className="h-11"
            inputMode="decimal"
            autoFocus
            value={score}
            onChange={(e) => setScore(e.target.value)}
            {...invalid('score')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-max`}>Out of</Label>
          <Input
            id={`${id}-max`}
            className="h-11"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            {...invalid('max')}
          />
        </div>
      </div>
      {submitted && errors.score && (
        <p id={`${id}-score-error`} className="text-sm text-destructive">
          {errors.score}
        </p>
      )}
      {submitted && errors.max && (
        <p id={`${id}-max-error`} className="text-sm text-destructive">
          {errors.max}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-kind`}>Kind</Label>
        <NativeSelect
          id={`${id}-kind`}
          value={kind}
          onChange={(e) => setKind(e.target.value as ScoreKind)}
        >
          {SCORE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SCORE_KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Textarea
          id={`${id}-note`}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button type="submit" className="h-11 self-start" disabled={pending}>
        {pending ? 'Saving…' : 'Save and complete'}
      </Button>
    </form>
  );
}
