import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { NodeLabel } from '@/components/NodeLabel';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Session, TreeNode } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import { nodePath } from '@/core/logic/tree';
import { SESSION_KEYS, useDataMutation } from '@/data/queries';
import { useUndoToast } from '@/features/changes/useUndo';
import { LogForm } from '@/features/log/LogForm';
import type { LogFormValues } from '@/features/log/LogForm';
import { formatDay } from '@/lib/format';

// One session in History, with Edit and Delete (HIST-2) and the "via Claude" badge (HIST-4).
/** DATA-1: the note with every case-insensitive match of `term` marked. */
function Highlighted({ text, term }: { text: string; term: string | undefined }) {
  if (!term) return text;
  const lower = text.toLowerCase();
  const wanted = term.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(wanted); at !== -1; at = lower.indexOf(wanted, from)) {
    parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-primary/15 px-0.5 text-foreground">
        {text.slice(at, at + wanted.length)}
      </mark>,
    );
    from = at + wanted.length;
  }
  parts.push(text.slice(from));
  return parts;
}

export function SessionRow({
  session,
  nodes,
  today,
  highlight,
}: {
  session: Session;
  nodes: readonly TreeNode[];
  today: string;
  /** DATA-1: the searched text, marked in the note. */
  highlight?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const name = nodePath(nodes, session.nodeId).at(-1) ?? 'session';
  const summary = `${formatDuration(session.minutes)} of ${name}`;

  const update = useDataMutation(
    (ds, values: LogFormValues) => ds.updateSession(session.id, values),
    SESSION_KEYS,
    {
      onSuccess: () => {
        setEditing(false);
        toast.success('Session updated.');
      },
    },
  );
  const undoToast = useUndoToast();
  const remove = useDataMutation((ds) => ds.deleteSession(session.id), SESSION_KEYS, {
    onSuccess: () => {
      setEditing(false);
      undoToast('Session deleted.', 'session', session.id);
    },
  });

  return (
    <li className="flex items-start gap-3 p-3">
      {/* UNDO-2: tapping the session opens its edit sheet. */}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setEditing(true)}
      >
        {/* The accessible name is the visible text (WCAG 2.5.3), introduced as an edit. */}
        <span className="sr-only">Edit: </span>
        <span className="flex flex-wrap items-center gap-2">
          <NodeLabel nodes={nodes} nodeId={session.nodeId} className="font-medium" />
          {session.source === 'claude' && <Badge variant="secondary">via Claude</Badge>}
        </span>
        <span className="text-sm text-muted-foreground">{formatDuration(session.minutes)}</span>
        {session.note && (
          <span className="text-sm break-words whitespace-pre-line">
            <Highlighted text={session.note} term={highlight} />
          </span>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Edit ${summary}`}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label={`Delete ${summary}`}
        onClick={() => setConfirmingDelete(true)}
      >
        <Trash2 aria-hidden="true" />
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>{formatDay(session.studiedOn)}</DialogDescription>
          </DialogHeader>
          <LogForm
            nodes={nodes}
            today={today}
            initial={{ ...session, note: session.note ?? '' }}
            editing={session}
            submitLabel="Save changes"
            pending={update.isPending}
            onSubmit={(values) => update.mutate(values)}
          />
          <Button
            variant="ghost"
            className="h-11 self-start text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete…
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary} on {formatDay(session.studiedOn)}. You can undo it from Recent changes.
            </AlertDialogDescription>
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
