import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Chip } from '@/components/Chip';
import { DayField } from '@/components/DayField';
import { NativeSelect } from '@/components/NativeSelect';
import { NodeSelect } from '@/components/NodeSelect';
import { QueryError } from '@/components/QueryError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { Mistake, MistakesOverview, ReviewResult, TreeNode } from '@/core/domain/types';
import { nodePath } from '@/core/logic/tree';
import { MAX_MISTAKE_LENGTH } from '@/core/schemas/inputs';
import { useDataMutation, useMistakes, useTree } from '@/data/queries';
import { useToday } from '@/data/useToday';
import { useUndoToast } from '@/features/changes/useUndo';
import { formatDay } from '@/lib/format';
import { pastDayError } from '@/lib/pastDay';

// ERR-1, ERR-3, ERR-4: mistakes to review +1, +3, and +7 days after they were made. "Due today"
// has Right and Wrong buttons; "All" groups every mistake by where it belongs.

const MISTAKE_KEYS = ['mistakes', 'changes'];
type Filter = 'open' | 'learned' | 'all';

const pathOf = (nodes: readonly TreeNode[], id: string) => nodePath(nodes, id).join(' > ');

export function MistakesPage() {
  const overview = useMistakes();
  const tree = useTree();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'all' ? 'all' : 'due';
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mistakes</h1>
        <Button className="h-11" disabled={!tree.data} onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add mistake
        </Button>
      </div>
      {(overview.isPending || tree.isPending) && <Skeleton className="h-64 w-full" />}
      {overview.isError && (
        <QueryError error={overview.error} onRetry={() => void overview.refetch()} />
      )}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {overview.data && tree.data && (
        <>
          <ModuleCounts nodes={tree.data} modules={overview.data.modules} />
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            <Chip pressed={tab === 'due'} onClick={() => setParams({}, { replace: true })}>
              {`Due today (${overview.data.due.length})`}
            </Chip>
            <Chip
              pressed={tab === 'all'}
              onClick={() => setParams({ tab: 'all' }, { replace: true })}
            >
              {`All (${overview.data.all.length})`}
            </Chip>
          </div>
          {tab === 'due' ? (
            <DueList overview={overview.data} nodes={tree.data} />
          ) : (
            <AllList overview={overview.data} nodes={tree.data} />
          )}
        </>
      )}
      {tree.data && (
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a mistake</DialogTitle>
              <DialogDescription>It comes up for review 1, 3, and 7 days later.</DialogDescription>
            </DialogHeader>
            {adding && <AddMistakeForm nodes={tree.data} onDone={() => setAdding(false)} />}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** ERR-4: open vs learned per module. */
function ModuleCounts({
  nodes,
  modules,
}: {
  nodes: readonly TreeNode[];
  modules: MistakesOverview['modules'];
}) {
  if (modules.length === 0) return null;
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const sorted = [...modules].sort(
    (a, b) => (order.get(a.moduleId) ?? 0) - (order.get(b.moduleId) ?? 0),
  );
  return (
    <section aria-labelledby="modules-heading" className="flex flex-col gap-2">
      <h2 id="modules-heading" className="sr-only">
        By module
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sorted.map((m) => (
          <li key={m.moduleId} className="flex flex-col rounded-lg border p-3">
            <span className="font-medium">{pathOf(nodes, m.moduleId)}</span>
            <span className="text-sm text-muted-foreground">
              {m.open} open · {m.learned} learned
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function stepText(mistake: Mistake): string {
  return `Review ${mistake.step} of 3`;
}

/** ERR-3: open mistakes due on or before today, oldest due first, with Right and Wrong. */
function DueList({ overview, nodes }: { overview: MistakesOverview; nodes: readonly TreeNode[] }) {
  if (overview.due.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6">
        Nothing to review today. Add a mistake when you make one, and it comes back 1, 3, and 7 days
        later.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {overview.due.map((mistake) => (
        <DueRow key={mistake.id} mistake={mistake} nodes={nodes} today={overview.today} />
      ))}
    </ul>
  );
}

function DueRow({
  mistake,
  nodes,
  today,
}: {
  mistake: Mistake;
  nodes: readonly TreeNode[];
  today: string;
}) {
  const undoToast = useUndoToast();
  const review = useDataMutation(
    (ds, result: ReviewResult) => ds.reviewMistake(mistake.id, { result }),
    MISTAKE_KEYS,
    {
      onSuccess: (reviewed) =>
        undoToast(
          reviewed.status === 'learned'
            ? 'Right: learned.'
            : reviewed.lastResult === 'right'
              ? `Right: next review ${formatDay(reviewed.nextDueOn ?? today)}.`
              : 'Wrong: it comes back tomorrow.',
          'mistake',
          mistake.id,
        ),
    },
  );
  const late = mistake.nextDueOn !== null && mistake.nextDueOn < today;
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <p className="break-words whitespace-pre-line">{mistake.text}</p>
        <p className="text-sm text-muted-foreground">
          {pathOf(nodes, mistake.nodeId)} · {stepText(mistake)}
          {late && mistake.nextDueOn && ` · due since ${formatDay(mistake.nextDueOn)}`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          className="h-11"
          disabled={review.isPending}
          aria-label={`Right: ${mistake.text}`}
          onClick={() => review.mutate('right')}
        >
          Right
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={review.isPending}
          aria-label={`Wrong: ${mistake.text}`}
          onClick={() => review.mutate('wrong')}
        >
          Wrong
        </Button>
      </div>
    </li>
  );
}

/** ERR-3: every mistake, grouped by node path, filtered by open / learned / all. */
function AllList({ overview, nodes }: { overview: MistakesOverview; nodes: readonly TreeNode[] }) {
  const id = useId();
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Mistake | null>(null);
  const shown = overview.all.filter((m) => filter === 'all' || m.status === filter);
  const groups = new Map<string, Mistake[]>();
  for (const mistake of shown) {
    const path = pathOf(nodes, mistake.nodeId);
    groups.set(path, [...(groups.get(path) ?? []), mistake]);
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:w-56">
        <Label htmlFor={`${id}-filter`}>Show</Label>
        <NativeSelect
          id={`${id}-filter`}
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          <option value="open">Open</option>
          <option value="learned">Learned</option>
          <option value="all">All</option>
        </NativeSelect>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">
          {overview.all.length === 0 ? 'No mistakes yet.' : 'None here with this filter.'}
        </p>
      ) : (
        [...groups].map(([path, mistakes]) => (
          <section key={path} className="flex flex-col gap-2" aria-label={path}>
            <h2 className="font-medium">{path}</h2>
            <ul className="flex flex-col divide-y rounded-lg border">
              {mistakes.map((mistake) => (
                <li key={mistake.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setEditing(mistake)}
                  >
                    <span className="break-words whitespace-pre-line">{mistake.text}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {mistake.status === 'learned' ? (
                        <Badge variant="secondary">Learned</Badge>
                      ) : (
                        `${stepText(mistake)} · next ${formatDay(mistake.nextDueOn ?? overview.today)}`
                      )}
                      {mistake.source === 'claude' && <Badge variant="secondary">via Claude</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit mistake</DialogTitle>
            <DialogDescription>
              Noted on {editing && formatDay(editing.createdOn)}.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <EditMistakeForm
              key={editing.id}
              mistake={editing}
              nodes={nodes}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MistakeFields({
  nodes,
  nodeId,
  text,
  onNode,
  onText,
  errors,
}: {
  nodes: readonly TreeNode[];
  nodeId: string;
  text: string;
  onNode: (id: string) => void;
  onText: (text: string) => void;
  errors: { nodeId: string | null; text: string | null } | null;
}) {
  const id = useId();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-node`}>About</Label>
        <NodeSelect
          id={`${id}-node`}
          nodes={nodes}
          value={nodeId}
          onChange={onNode}
          aria-invalid={errors?.nodeId ? true : undefined}
          aria-describedby={errors?.nodeId ? `${id}-node-error` : undefined}
        />
        {errors?.nodeId && (
          <p id={`${id}-node-error`} className="text-sm text-destructive">
            {errors.nodeId}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-text`}>Mistake and the right answer</Label>
        <Textarea
          id={`${id}-text`}
          maxLength={MAX_MISTAKE_LENGTH}
          placeholder="e.g. der Tisch, not die Tisch"
          value={text}
          onChange={(e) => onText(e.target.value)}
          aria-invalid={errors?.text ? true : undefined}
          aria-describedby={errors?.text ? `${id}-text-error` : undefined}
        />
        {errors?.text && (
          <p id={`${id}-text-error`} className="text-sm text-destructive">
            {errors.text}
          </p>
        )}
      </div>
    </>
  );
}

function AddMistakeForm({ nodes, onDone }: { nodes: readonly TreeNode[]; onDone: () => void }) {
  const today = useToday();
  const undoToast = useUndoToast();
  const [nodeId, setNodeId] = useState('');
  const [text, setText] = useState('');
  const [createdOn, setCreatedOn] = useState(today);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    nodeId: nodeId ? null : 'Choose what it’s about.',
    text: text.trim() ? null : 'Describe the mistake.',
    createdOn: pastDayError(createdOn, today),
  };
  const add = useDataMutation(
    (ds, input: { nodeId: string; text: string; createdOn: string }) => ds.addMistake(input),
    MISTAKE_KEYS,
    {
      onSuccess: (mistake) => {
        onDone();
        undoToast(
          `Mistake saved. First review ${formatDay(mistake.nextDueOn ?? today)}.`,
          'mistake',
          mistake.id,
        );
      },
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.nodeId || errors.text || errors.createdOn) return;
    add.mutate({ nodeId, text: text.trim(), createdOn });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <MistakeFields
        nodes={nodes}
        nodeId={nodeId}
        text={text}
        onNode={setNodeId}
        onText={setText}
        errors={submitted ? errors : null}
      />
      <DayField
        legend="Made on"
        value={createdOn}
        today={today}
        onChange={setCreatedOn}
        error={submitted ? errors.createdOn : null}
      />
      <Button type="submit" className="h-11 self-start" disabled={add.isPending}>
        {add.isPending ? 'Saving…' : 'Save mistake'}
      </Button>
    </form>
  );
}

function EditMistakeForm({
  mistake,
  nodes,
  onDone,
}: {
  mistake: Mistake;
  nodes: readonly TreeNode[];
  onDone: () => void;
}) {
  const undoToast = useUndoToast();
  const [nodeId, setNodeId] = useState(mistake.nodeId);
  const [text, setText] = useState(mistake.text);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    nodeId: nodeId ? null : 'Choose what it’s about.',
    text: text.trim() ? null : 'Describe the mistake.',
  };
  const save = useDataMutation(
    (ds, input: { nodeId: string; text: string }) => ds.updateMistake(mistake.id, input),
    MISTAKE_KEYS,
    {
      onSuccess: () => {
        onDone();
        toast.success('Mistake updated.');
      },
    },
  );
  const remove = useDataMutation((ds) => ds.deleteMistake(mistake.id), MISTAKE_KEYS, {
    onSuccess: () => {
      onDone();
      undoToast('Mistake deleted.', 'mistake', mistake.id);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.nodeId || errors.text) return;
    save.mutate({ nodeId, text: text.trim() });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <MistakeFields
        nodes={nodes}
        nodeId={nodeId}
        text={text}
        onNode={setNodeId}
        onText={setText}
        errors={submitted ? errors : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {!confirming ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-destructive"
            onClick={() => setConfirming(true)}
          >
            Delete…
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className="h-11"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined)}
          >
            Yes, delete
          </Button>
        )}
      </div>
    </form>
  );
}
