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
import { LogForm } from '@/features/log/LogForm';
import type { LogFormValues } from '@/features/log/LogForm';
import { formatDay } from '@/lib/format';

// One session in History, with Edit and Delete (HIST-2) and the "via Claude" badge (HIST-4).
export function SessionRow({
  session,
  nodes,
  today,
}: {
  session: Session;
  nodes: readonly TreeNode[];
  today: string;
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
  const remove = useDataMutation((ds) => ds.deleteSession(session.id), SESSION_KEYS, {
    onSuccess: () => toast.success('Session deleted.'),
  });

  return (
    <li className="flex items-start gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <NodeLabel nodes={nodes} nodeId={session.nodeId} className="font-medium" />
          {session.source === 'claude' && <Badge variant="secondary">via Claude</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{formatDuration(session.minutes)}</p>
        {session.note && <p className="text-sm break-words whitespace-pre-line">{session.note}</p>}
      </div>
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
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary} on {formatDay(session.studiedOn)}. This can’t be undone.
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
