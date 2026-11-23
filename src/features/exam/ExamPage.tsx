import { Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { NativeSelect } from '@/components/NativeSelect';
import { QueryError } from '@/components/QueryError';
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
import type { ExamTarget, ExamView, TreeNode } from '@/core/domain/types';
import { targetSteps } from '@/core/logic/exam';
import { nodePath } from '@/core/logic/tree';
import { useDataMutation, useExamView, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useUndoToast } from '@/features/changes/useUndo';
import { ScoreChart } from '@/features/scores/ScoreChart';
import type { ChartLine } from '@/features/scores/ScoreChart';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';

// EXAM-2–6: the countdown to an exam, its score targets, % per module over time with the target
// line, and the mock grid that marks results below their target in red and in words.

const EXAM_KEYS = ['exam', 'changes'];

type Exam = NonNullable<ExamView['exam']>;

/** EXAM-2: "23 days left", "Today", or "2 days ago". */
function countdown(daysLeft: number): string {
  if (daysLeft === 0) return 'Today';
  if (daysLeft > 0) return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
  return `${-daysLeft} ${daysLeft === -1 ? 'day' : 'days'} ago`;
}

export function ExamPage() {
  const { basePath } = useDataSource();
  const [params, setParams] = useSearchParams();
  const view = useExamView(params.get('deadline') ?? undefined);
  const tree = useTree();
  const id = useId();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Exam</h1>
      {(view.isPending || tree.isPending) && <Skeleton className="h-96 w-full" />}
      {view.isError && <QueryError error={view.error} onRetry={() => void view.refetch()} />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {view.data && !view.data.exam && (
        <p className="rounded-lg border border-dashed p-6">
          No exam yet. In{' '}
          <Link to={`${basePath}/settings/deadlines`} className="underline underline-offset-4">
            Settings → Deadlines
          </Link>
          , add or edit a deadline and switch on “This is an exam” to see its countdown, targets,
          and mock results here.
        </p>
      )}
      {view.data?.exam && tree.data && (
        <>
          {view.data.exams.length > 1 && (
            <div className="flex flex-col gap-2 sm:w-80">
              <Label htmlFor={`${id}-exam`}>Exam</Label>
              <NativeSelect
                id={`${id}-exam`}
                value={view.data.exam.summary.deadlineId}
                onChange={(e) => setParams({ deadline: e.target.value }, { replace: true })}
              >
                {view.data.exams.map((exam) => (
                  <option key={exam.deadlineId} value={exam.deadlineId}>
                    {exam.title} · {formatDay(exam.dueOn)}
                    {exam.daysLeft < 0 ? ' (past)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <ExamContent exam={view.data.exam} nodes={tree.data} />
        </>
      )}
    </>
  );
}

function ExamContent({ exam, nodes }: { exam: Exam; nodes: readonly TreeNode[] }) {
  const { summary } = exam;
  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="countdown-heading"
        className="flex flex-col gap-1 rounded-lg border p-4"
      >
        <h2 id="countdown-heading" className="text-sm text-muted-foreground">
          {summary.title} · {formatDay(summary.dueOn)} ·{' '}
          {nodePath(nodes, summary.nodeId).join(' > ')}
        </h2>
        <p className="text-4xl font-semibold">{countdown(summary.daysLeft)}</p>
      </section>
      <TargetsSection exam={exam} />
      <ChartSection exam={exam} />
      <MockGrid exam={exam} />
    </div>
  );
}

function TargetsSection({ exam }: { exam: Exam }) {
  const [editing, setEditing] = useState<ExamTarget | null>(null);
  const undoToast = useUndoToast();
  const add = useDataMutation(
    (ds, values: TargetValues) =>
      ds.addExamTarget(exam.summary.deadlineId, {
        label: values.label,
        targetOn: values.targetOn,
        minPercent: Number(values.minPercent),
      }),
    EXAM_KEYS,
    {
      onSuccess: (target) =>
        undoToast(`Added the target “${target.label}”.`, 'exam_target', target.id),
    },
  );
  const update = useDataMutation(
    (ds, values: TargetValues & { id: string }) =>
      ds.updateExamTarget(values.id, {
        label: values.label,
        targetOn: values.targetOn,
        minPercent: Number(values.minPercent),
      }),
    EXAM_KEYS,
    { onSuccess: () => setEditing(null) },
  );
  const remove = useDataMutation(
    (ds, target: ExamTarget) => ds.deleteExamTarget(target.id).then(() => target),
    EXAM_KEYS,
    {
      onSuccess: (target) =>
        undoToast(`Deleted the target “${target.label}”.`, 'exam_target', target.id),
    },
  );

  return (
    <section aria-labelledby="targets-heading" className="flex flex-col gap-3">
      <h2 id="targets-heading" className="text-lg font-medium">
        Score targets
      </h2>
      {exam.targets.length === 0 ? (
        <p className="text-muted-foreground">
          No targets yet. Add one for each mock, e.g. “Mock 1 · 1 Dec · 60%”.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {exam.targets.map((target) => (
            <li key={target.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{target.label}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatDay(target.targetOn)} · at least {target.minPercent}%
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Edit target ${target.label}`}
                onClick={() => setEditing(target)}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Delete target ${target.label}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(target)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Add a target</summary>
        <div className="pt-3">
          <TargetForm
            initial={{ label: '', targetOn: exam.summary.dueOn, minPercent: '' }}
            submitLabel="Add target"
            pending={add.isPending}
            onSubmit={(values, reset) => add.mutate(values, { onSuccess: reset })}
          />
        </div>
      </details>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit target</DialogTitle>
            <DialogDescription>{editing?.label}</DialogDescription>
          </DialogHeader>
          {editing && (
            <TargetForm
              key={editing.id}
              initial={{
                label: editing.label,
                targetOn: editing.targetOn,
                minPercent: String(editing.minPercent),
              }}
              submitLabel="Save"
              pending={update.isPending}
              onSubmit={(values) => update.mutate({ ...values, id: editing.id })}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface TargetValues {
  label: string;
  targetOn: string;
  minPercent: string;
}

function TargetForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  initial: TargetValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: TargetValues, reset: () => void) => void;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const percent = Number(values.minPercent);
  const errors = {
    label: values.label.trim() ? null : 'Enter a label, e.g. Mock 1.',
    targetOn: /^\d{4}-\d{2}-\d{2}$/.test(values.targetOn) ? null : 'Choose a date.',
    minPercent:
      values.minPercent.trim() !== '' && Number.isFinite(percent) && percent >= 0 && percent <= 100
        ? null
        : 'Enter 0 to 100.',
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit({ ...values, label: values.label.trim() }, () => {
      setValues(initial);
      setSubmitted(false);
    });
  }

  const describe = (key: keyof TargetValues) =>
    submitted && errors[key]
      ? { 'aria-invalid': true, 'aria-describedby': `${id}-${key}-error` }
      : {};
  const error = (key: keyof TargetValues) =>
    submitted &&
    errors[key] && (
      <p id={`${id}-${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    );

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-label`}>Label</Label>
          <Input
            id={`${id}-label`}
            className="h-11"
            maxLength={60}
            placeholder="Mock 1"
            value={values.label}
            onChange={(e) => setValues({ ...values, label: e.target.value })}
            {...describe('label')}
          />
          {error('label')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-date`}>By</Label>
          <Input
            id={`${id}-date`}
            type="date"
            className="h-11"
            value={values.targetOn}
            onChange={(e) => setValues({ ...values, targetOn: e.target.value })}
            {...describe('targetOn')}
          />
          {error('targetOn')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-percent`}>At least (%)</Label>
          <Input
            id={`${id}-percent`}
            className="h-11"
            inputMode="decimal"
            placeholder="60"
            value={values.minPercent}
            onChange={(e) => setValues({ ...values, minPercent: e.target.value })}
            {...describe('minPercent')}
          />
          {error('minPercent')}
        </div>
      </div>
      <Button type="submit" className="h-11 self-start" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

/** EXAM-4: % over time per module, with the stepped target line. */
function ChartSection({ exam }: { exam: Exam }) {
  const names = new Map(exam.modules.map((m) => [m.id, m.name]));
  const lines: ChartLine[] = exam.series
    .filter((s) => s.points.length > 0)
    .map((s) => ({
      nodeId: s.moduleId,
      label: names.get(s.moduleId) ?? 'Module',
      colorIndex: exam.modules.findIndex((m) => m.id === s.moduleId),
      points: s.points.map((p, index) => ({
        scoreId: `${s.moduleId}-${index}`,
        date: p.date,
        percent: p.percent,
      })),
      trend: null,
    }));
  return (
    <section aria-labelledby="exam-chart-heading" className="flex flex-col gap-3">
      <h2 id="exam-chart-heading" className="text-lg font-medium">
        Results by module
      </h2>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">
          No scores yet. Scores recorded on this exam’s part of the tree show here, one line per
          module.
        </p>
      ) : (
        <ScoreChart lines={lines} targets={targetSteps(exam.targets)} />
      )}
    </section>
  );
}

/** EXAM-5, EXAM-6: mock tests by modules; below-target cells are red and say so in words. */
function MockGrid({ exam }: { exam: Exam }) {
  return (
    <section aria-labelledby="mocks-heading" className="flex flex-col gap-3">
      <h2 id="mocks-heading" className="text-lg font-medium">
        Mock tests
      </h2>
      {exam.mocks.length === 0 ? (
        <p className="text-muted-foreground">
          No mock tests yet. Record scores of the kind “Mock test” on this exam’s modules; scores
          with the same title make one row.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="p-3 font-medium">
                  Mock
                </th>
                {exam.modules.map((module) => (
                  <th key={module.id} scope="col" className="p-3 text-right font-medium">
                    {module.name}
                  </th>
                ))}
                <th scope="col" className="p-3 text-right font-medium">
                  Average
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {exam.mocks.map((row) => (
                <tr key={row.title} className="align-top">
                  <th scope="row" className="p-3 text-left font-medium">
                    {row.title}
                    <span className="block font-normal text-muted-foreground">
                      {formatDay(row.firstDate)}
                    </span>
                  </th>
                  {exam.modules.map((module) => {
                    const cell = row.cells[module.id] ?? null;
                    const below = cell && row.target && cell.percent < row.target.minPercent;
                    return (
                      <td
                        key={module.id}
                        className={cn(
                          'p-3 text-right whitespace-nowrap',
                          below && 'text-destructive',
                        )}
                      >
                        {cell ? (
                          <>
                            <span className="block font-medium">{cell.percent}%</span>
                            <span className={cn('block', !below && 'text-muted-foreground')}>
                              {cell.score} / {cell.maxScore}
                            </span>
                            {below && row.target && (
                              <span className="block">▼ below {row.target.minPercent}%</span>
                            )}
                          </>
                        ) : (
                          <span aria-label="No score">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right whitespace-nowrap">
                    {row.average === null ? '—' : `${row.average}%`}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {row.target ? `${row.target.minPercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
