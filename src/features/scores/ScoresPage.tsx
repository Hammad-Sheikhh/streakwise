import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SCORE_KINDS } from '@/core/domain/types';
import type { Score, ScoreKind, TreeNode } from '@/core/domain/types';
import { defaultKind, scorePercent } from '@/core/logic/scores';
import { hiddenIds } from '@/core/logic/tree';
import { useDataMutation, useScores, useTree } from '@/data/queries';
import { useToday } from '@/data/useToday';
import { formatDay, SCORE_KIND_LABELS } from '@/lib/format';

import { ScoreChart } from './ScoreChart';
import { ScoreForm } from './ScoreForm';
import type { ScoreValues } from './ScoreForm';
import { chartLines, filterScores } from './scoreView';

// SCORE-1–5: record scores, chart them per subtask, and list every result.

const SCORE_KEYS = ['scores', 'track'];

const toInput = (values: ScoreValues) => ({
  kind: values.kind,
  title: values.title.trim(),
  takenOn: values.takenOn,
  score: Number(values.score),
  maxScore: Number(values.maxScore),
  nodeId: values.nodeId,
  note: values.note.trim() || null,
});

/** The kind filter and chart for one track (the track page) or any track (the Scores screen). */
export function ScoreChartSection({
  nodes,
  scores,
  trackId,
  kind,
  onKindChange,
}: {
  nodes: readonly TreeNode[];
  scores: readonly Score[];
  trackId: string;
  kind: ScoreKind | '';
  onKindChange: (kind: ScoreKind | '') => void;
}) {
  const id = useId();
  const shown = filterScores(nodes, scores, trackId, kind);
  const lines = chartLines(nodes, scores, shown);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-56 flex-col gap-2">
        <Label htmlFor={`${id}-kind`}>Kind</Label>
        <NativeSelect
          id={`${id}-kind`}
          value={kind}
          onChange={(e) => {
            const value = e.target.value;
            onKindChange(SCORE_KINDS.find((k) => k === value) ?? '');
          }}
        >
          <option value="">All kinds</option>
          {SCORE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SCORE_KIND_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6">
          No {kind ? SCORE_KIND_LABELS[kind].toLowerCase() : 'score'} results here yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border p-3">
          <ScoreChart lines={lines} />
        </div>
      )}
    </div>
  );
}

/** SCORE-3: every result, newest first, with edit and delete. */
export function ScoreTable({
  nodes,
  scores,
  onEdit,
  onDelete,
}: {
  nodes: readonly TreeNode[];
  scores: readonly Score[];
  onEdit?: (score: Score) => void;
  onDelete?: (score: Score) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="p-3 font-medium">
              Date
            </th>
            <th scope="col" className="p-3 font-medium">
              Result
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              Score
            </th>
            {onEdit && (
              <th scope="col" className="p-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {scores.map((s) => (
            <tr key={s.id} className="align-top">
              <td className="p-3 whitespace-nowrap">{formatDay(s.takenOn)}</td>
              <td className="min-w-40 p-3">
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground">{SCORE_KIND_LABELS[s.kind]}</p>
                <NodeLabel nodes={nodes} nodeId={s.nodeId} className="text-muted-foreground" />
                {s.note && <p className="mt-1 whitespace-pre-wrap">{s.note}</p>}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                <p className="font-medium">{scorePercent(s.score, s.maxScore)}%</p>
                <p className="text-muted-foreground">
                  {s.score} / {s.maxScore}
                </p>
              </td>
              {onEdit && onDelete && (
                <td className="p-1 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Edit ${s.title}`}
                    onClick={() => onEdit(s)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Delete ${s.title}`}
                    onClick={() => onDelete(s)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoresPage() {
  const today = useToday();
  const tree = useTree();
  const scores = useScores();
  const trackFilterId = useId();
  const [trackId, setTrackId] = useState('');
  const [kind, setKind] = useState<ScoreKind | ''>('');
  // Dialogs stay mounted while they close, so the last score acted on is kept.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Score | null>(null);
  const [deleting, setDeleting] = useState<Score | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = useDataMutation(
    (ds, values: ScoreValues) =>
      editing ? ds.updateScore(editing.id, toInput(values)) : ds.addScore(toInput(values)),
    SCORE_KEYS,
    {
      onSuccess: () => {
        setFormOpen(false);
        toast.success(editing ? 'Score updated.' : 'Score saved.');
      },
    },
  );
  const remove = useDataMutation((ds, id: string) => ds.deleteScore(id), SCORE_KEYS, {
    onSuccess: () => toast.success('Score deleted.'),
  });

  const nodes = tree.data ?? [];
  const all = scores.data ?? [];
  const hidden = hiddenIds(nodes);
  const tracks = nodes.filter((n) => n.depth === 1 && !hidden.has(n.id));
  const shown = filterScores(nodes, all, trackId, kind);

  function chooseTrack(id: string) {
    setTrackId(id);
    // SCORE-5: each track opens on the kind it records most.
    setKind(id ? (defaultKind(filterScores(nodes, all, id, '')) ?? '') : '');
  }

  function openForm(score: Score | null) {
    setEditing(score);
    setFormOpen(true);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Scores</h1>
        <Button className="h-11" disabled={!tree.data} onClick={() => openForm(null)}>
          <Plus aria-hidden="true" /> Add score
        </Button>
      </div>

      {(tree.isPending || scores.isPending) && <Skeleton className="h-64 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {scores.isError && <QueryError error={scores.error} onRetry={() => void scores.refetch()} />}

      {tree.data && scores.data && all.length === 0 && (
        <p className="rounded-lg border border-dashed p-6">
          No scores yet. Add a past paper, quiz, or revision test result, or complete a scored task.
        </p>
      )}

      {tree.data && scores.data && all.length > 0 && (
        <>
          <section aria-labelledby="score-chart" className="flex flex-col gap-3">
            <h2 id="score-chart" className="text-lg font-medium">
              Over time
            </h2>
            <div className="flex max-w-56 flex-col gap-2">
              <Label htmlFor={trackFilterId}>Track</Label>
              <NativeSelect
                id={trackFilterId}
                value={trackId}
                onChange={(e) => chooseTrack(e.target.value)}
              >
                <option value="">All tracks</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <ScoreChartSection
              nodes={nodes}
              scores={all}
              trackId={trackId}
              kind={kind}
              onKindChange={setKind}
            />
          </section>

          <section aria-labelledby="score-results" className="flex flex-col gap-3">
            <h2 id="score-results" className="text-lg font-medium">
              Results
            </h2>
            {shown.length === 0 ? (
              <p className="text-muted-foreground">No results match these filters.</p>
            ) : (
              <ScoreTable
                nodes={nodes}
                scores={shown}
                onEdit={openForm}
                onDelete={(score) => {
                  setDeleting(score);
                  setConfirmOpen(true);
                }}
              />
            )}
          </section>
        </>
      )}

      {tree.data && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit score' : 'Add a score'}</DialogTitle>
              <DialogDescription>
                {editing ? editing.title : 'A past paper, quiz, mock, or revision test.'}
              </DialogDescription>
            </DialogHeader>
            {formOpen && (
              <ScoreForm
                nodes={nodes}
                today={today}
                initial={
                  editing
                    ? {
                        kind: editing.kind,
                        title: editing.title,
                        takenOn: editing.takenOn,
                        score: String(editing.score),
                        maxScore: String(editing.maxScore),
                        nodeId: editing.nodeId,
                        note: editing.note ?? '',
                      }
                    : {
                        kind: kind || 'past_paper',
                        title: '',
                        takenOn: today,
                        score: '',
                        maxScore: '',
                        nodeId: trackId,
                        note: '',
                      }
                }
                submitLabel={editing ? 'Save changes' : 'Save score'}
                pending={save.isPending}
                onSubmit={(values) => save.mutate(values)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.taskCompletionId
                ? 'It was recorded with a task; the task stays completed. '
                : ''}
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
