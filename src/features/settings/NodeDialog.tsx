import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { trackSwatchClass } from '@/components/trackColors';
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
import { MAX_DEPTH, TRACK_COLORS } from '@/core/domain/types';
import type { TrackColor, TreeNode } from '@/core/domain/types';
import { hiddenIds, nodePath } from '@/core/logic/tree';
import { DataSourceError } from '@/data/DataSource';
import { useDataMutation } from '@/data/queries';
import { cn } from '@/lib/utils';

import { LEVEL_NAMES } from './levels';

// Manage one node: rename, recolor (tracks, TREE-4), add a child (TREE-1), archive or restore
// (TREE-2, TREE-5), and delete when nothing has history (TREE-3).
export function NodeDialog({
  node,
  nodes,
  open,
  onClose,
}: {
  node: TreeNode;
  nodes: readonly TreeNode[];
  open: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const levels: readonly string[] = LEVEL_NAMES;
  const level = levels[node.depth - 1] ?? 'item';
  const childLevel = levels[node.depth];
  const underArchived = !node.archivedAt && hiddenIds(nodes).has(node.id);
  const [name, setName] = useState(node.name);
  const [childName, setChildName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inUse, setInUse] = useState(false);

  const update = useDataMutation(
    (ds, input: { name?: string; color?: TrackColor; archived?: boolean }) =>
      ds.updateNode(node.id, input),
    ['tree'],
  );
  const addChild = useDataMutation(
    (ds, value: string) => ds.addNode({ parentId: node.id, name: value }),
    ['tree'],
    {
      onSuccess: (child) => {
        setChildName('');
        toast.success(`Added “${child.name}”.`);
      },
    },
  );
  const remove = useDataMutation((ds) => ds.deleteNode(node.id), ['tree'], {
    toastErrors: false,
    onSuccess: () => {
      toast.success(`Deleted “${node.name}”.`);
      onClose();
    },
  });

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() && name.trim() !== node.name) update.mutate({ name: name.trim() });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (childName.trim()) addChild.mutate(childName.trim());
  }

  function handleDelete() {
    remove.mutate(undefined, {
      onError: (error) => {
        if (error instanceof DataSourceError && error.code === 'node_in_use') setInUse(true);
        else toast.error(error.message);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{node.name}</DialogTitle>
          <DialogDescription>
            {level[0]?.toUpperCase()}
            {level.slice(1)}
            {node.depth > 1 && ` in ${nodePath(nodes, node.id).slice(0, -1).join(' › ')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <form className="flex flex-col gap-2" onSubmit={rename}>
            <Label htmlFor={`${id}-name`}>Name</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-name`}
                className="h-11"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                type="submit"
                className="h-11"
                disabled={!name.trim() || name.trim() === node.name || update.isPending}
              >
                Rename
              </Button>
            </div>
          </form>

          {node.depth === 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Color</legend>
              <div className="flex flex-wrap gap-2">
                {TRACK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={node.color === color}
                    onClick={() => update.mutate({ color })}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full border-2 border-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      node.color === color && 'border-foreground',
                    )}
                  >
                    <span className={cn('size-7 rounded-full', trackSwatchClass[color])} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {node.depth < MAX_DEPTH && childLevel && !node.archivedAt && !underArchived && (
            <form className="flex flex-col gap-2" onSubmit={add}>
              <Label htmlFor={`${id}-child`}>Add a {childLevel}</Label>
              <div className="flex gap-2">
                <Input
                  id={`${id}-child`}
                  className="h-11"
                  maxLength={60}
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
                <Button
                  type="submit"
                  className="h-11"
                  disabled={!childName.trim() || addChild.isPending}
                >
                  Add
                </Button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-3 border-t pt-4">
            {underArchived ? (
              <p className="text-sm text-muted-foreground">
                Hidden because something above it is archived. Restore that first.
              </p>
            ) : node.archivedAt ? (
              <Button
                variant="outline"
                className="h-11"
                disabled={update.isPending}
                onClick={() => update.mutate({ archived: false })}
              >
                Restore
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ archived: true }, { onSuccess: onClose })}
                >
                  Archive
                </Button>
                <p className="text-sm text-muted-foreground">
                  Hides it and everything inside it. Its history still counts in reports.
                </p>
              </div>
            )}

            {inUse ? (
              <p role="alert" className="text-sm">
                “{node.name}” or something inside it has history, so it can’t be deleted.
                {!node.archivedAt && ' Archive it instead.'}
              </p>
            ) : confirmDelete ? (
              <div role="group" aria-label="Confirm delete" className="flex flex-col gap-2">
                <p className="text-sm">
                  Delete “{node.name}” and everything inside it? This can’t be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="h-11"
                    disabled={remove.isPending}
                    onClick={handleDelete}
                  >
                    Yes, delete
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="h-11 text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete…
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
