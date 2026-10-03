import { Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@/components/NativeSelect';
import { NodeLabel } from '@/components/NodeLabel';
import { QueryError } from '@/components/QueryError';
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
import { Skeleton } from '@/components/ui/skeleton';
import type { Deadline, TreeNode } from '@/core/domain/types';
import { daysBetween } from '@/core/logic/dates';
import { hiddenIds } from '@/core/logic/tree';
import { useDataMutation, useDeadlines, useTree } from '@/data/queries';
import { useToday } from '@/data/useToday';
import { formatDay, formatDaysLeft } from '@/lib/format';

import { BackToSettings } from './BackToSettings';

// DEAD-1: add, edit, and delete deadlines (title, date, node).

interface DeadlineValues {
  title: string;
  dueOn: string;
  nodeId: string;
}

function DeadlineForm({
  nodes,
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  nodes: readonly TreeNode[];
  initial: DeadlineValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: DeadlineValues, reset: () => void) => void;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const hidden = hiddenIds(nodes);
  const options = nodes.filter((n) => !hidden.has(n.id) || n.id === initial.nodeId);
  const errors = {
    title: values.title.trim() ? null : 'Enter a title.',
    dueOn: /^\d{4}-\d{2}-\d{2}$/.test(values.dueOn) ? null : 'Choose a date.',
    nodeId: values.nodeId ? null : 'Choose what it’s for.',
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit({ ...values, title: values.title.trim() }, () => {
      setValues(initial);
      setSubmitted(false);
    });
  }

  const field = (key: keyof DeadlineValues) =>
    submitted && errors[key]
      ? { 'aria-invalid': true, 'aria-describedby': `${id}-${key}-error` }
      : {};
  const error = (key: keyof DeadlineValues) =>
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
          maxLength={200}
          placeholder="e.g. Maths exam"
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          {...field('title')}
        />
        {error('title')}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input
            id={`${id}-date`}
            type="date"
            className="h-11"
            value={values.dueOn}
            onChange={(e) => setValues({ ...values, dueOn: e.target.value })}
            {...field('dueOn')}
          />
          {error('dueOn')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-node`}>For</Label>
          <NativeSelect
            id={`${id}-node`}
            value={values.nodeId}
            onChange={(e) => setValues({ ...values, nodeId: e.target.value })}
            {...field('nodeId')}
          >
            <option value="">Choose…</option>
            {options.map((n) => (
              <option key={n.id} value={n.id}>
                {'  '.repeat(n.depth - 1)}
                {n.name}
              </option>
            ))}
          </NativeSelect>
          {error('nodeId')}
        </div>
      </div>
      <Button type="submit" className="h-11 self-start" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function DeadlineRow({
  deadline,
  nodes,
  today,
}: {
  deadline: Deadline;
  nodes: readonly TreeNode[];
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const update = useDataMutation(
    (ds, values: DeadlineValues) => ds.updateDeadline(deadline.id, values),
    ['deadlines'],
    {
      onSuccess: () => {
        setEditing(false);
        toast.success('Deadline updated.');
      },
    },
  );
  const remove = useDataMutation((ds) => ds.deleteDeadline(deadline.id), ['deadlines'], {
    onSuccess: () => toast.success('Deadline deleted.'),
  });
  const daysLeft = daysBetween(today, deadline.dueOn);

  return (
    <li className="flex items-start gap-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">{deadline.title}</p>
        <p className="text-sm text-muted-foreground">
          {formatDay(deadline.dueOn)}
          {daysLeft >= 0 && ` · ${formatDaysLeft(daysLeft)}`}
        </p>
        <NodeLabel nodes={nodes} nodeId={deadline.nodeId} className="text-sm" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Edit ${deadline.title}`}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Delete ${deadline.title}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" />
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit deadline</DialogTitle>
            <DialogDescription>{deadline.title}</DialogDescription>
          </DialogHeader>
          <DeadlineForm
            nodes={nodes}
            initial={{ title: deadline.title, dueOn: deadline.dueOn, nodeId: deadline.nodeId }}
            submitLabel="Save changes"
            pending={update.isPending}
            onSubmit={(values) => update.mutate(values)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deadline.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              variant="destructive"
              onClick={() => remove.mutate(undefined)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function DeadlinesPage() {
  const today = useToday();
  const tree = useTree();
  const deadlines = useDeadlines();
  const add = useDataMutation(
    (ds, values: DeadlineValues) => ds.addDeadline(values),
    ['deadlines'],
  );

  const upcoming = (deadlines.data ?? []).filter((d) => d.dueOn >= today);
  const past = (deadlines.data ?? []).filter((d) => d.dueOn < today).reverse();

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackToSettings />
        <h1 className="text-2xl font-semibold tracking-tight">Deadlines</h1>
        <p className="text-sm text-muted-foreground">
          Exams and due dates. Home counts down to the next three.
        </p>
      </div>

      {(tree.isPending || deadlines.isPending) && <Skeleton className="h-48 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {deadlines.isError && (
        <QueryError error={deadlines.error} onRetry={() => void deadlines.refetch()} />
      )}

      {tree.data && (
        <section
          aria-labelledby="add-deadline"
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          <h2 id="add-deadline" className="font-medium">
            Add a deadline
          </h2>
          <DeadlineForm
            nodes={tree.data}
            initial={{ title: '', dueOn: today, nodeId: '' }}
            submitLabel="Add deadline"
            pending={add.isPending}
            onSubmit={(values, reset) =>
              add.mutate(values, {
                onSuccess: () => {
                  reset();
                  toast.success('Deadline added.');
                },
              })
            }
          />
        </section>
      )}

      {tree.data && deadlines.data && (
        <>
          <section aria-labelledby="upcoming-deadlines" className="flex flex-col gap-3">
            <h2 id="upcoming-deadlines" className="text-lg font-medium">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">Nothing coming up.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {upcoming.map((d) => (
                  <DeadlineRow key={d.id} deadline={d} nodes={tree.data} today={today} />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-deadlines" className="flex flex-col gap-3">
              <h2 id="past-deadlines" className="text-lg font-medium">
                Past
              </h2>
              <ul className="flex flex-col divide-y rounded-lg border opacity-80">
                {past.map((d) => (
                  <DeadlineRow key={d.id} deadline={d} nodes={tree.data} today={today} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
