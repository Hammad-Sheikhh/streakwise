import { ArrowDown, ArrowLeft, ArrowUp, Settings2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { TreeNode } from '@/core/domain/types';
import { hiddenIds, sortSiblings, trackOf } from '@/core/logic/tree';
import { useDataMutation, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { cn } from '@/lib/utils';

import { LEVEL_NAMES } from './levels';
import { NodeDialog } from './NodeDialog';

// TREE-1–6: Settings → Structure.
export function StructurePage() {
  const { basePath } = useDataSource();
  const tree = useTree();
  const [showArchived, setShowArchived] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const archivedToggleId = useId();

  const move = useDataMutation(
    (ds, input: { id: string; direction: 'up' | 'down' }) =>
      ds.moveNode(input.id, { direction: input.direction }),
    ['tree'],
  );

  const nodes = tree.data ?? [];
  const hidden = hiddenIds(nodes);
  const shown = showArchived ? nodes : nodes.filter((n) => !hidden.has(n.id));
  const managed = nodes.find((n) => n.id === managing);

  /** Position among visible siblings, for the up/down buttons (archived ones don't count). */
  function position(node: TreeNode) {
    const siblings = sortSiblings(
      nodes.filter((n) => n.parentId === node.parentId && !hidden.has(n.id)),
    );
    const index = siblings.findIndex((n) => n.id === node.id);
    return { first: index <= 0, last: index === -1 || index === siblings.length - 1 };
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          to={`${basePath}/settings`}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Structure</h1>
        <p className="text-sm text-muted-foreground">
          Tracks hold subtasks, and subtasks hold topics. Time logged anywhere counts for everything
          above it.
        </p>
      </div>

      <AddTrackForm />

      <div className="flex items-center gap-2">
        <input
          id={archivedToggleId}
          type="checkbox"
          className="size-5 accent-primary"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        <Label htmlFor={archivedToggleId}>Show archived</Label>
      </div>

      {tree.isPending && <Skeleton className="h-64 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {tree.data && shown.length === 0 && (
        <p className="rounded-lg border border-dashed p-6">
          No tracks yet. Add one above to start logging.
        </p>
      )}
      {shown.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {shown.map((node) => {
            const isHidden = hidden.has(node.id);
            const { first, last } = position(node);
            const color = trackOf(nodes, node.id)?.color;
            return (
              <li
                key={node.id}
                className="flex items-center gap-1 py-1 pr-1"
                style={{ paddingInlineStart: `${0.75 + (node.depth - 1) * 1.25}rem` }}
              >
                {color && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mr-1 shrink-0 rounded-full',
                      node.depth === 1 ? 'size-3' : 'size-2 opacity-60',
                      trackSwatchClass[color],
                    )}
                  />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate',
                    node.depth === 1 && 'font-medium',
                    isHidden && 'text-muted-foreground line-through',
                  )}
                >
                  {node.name}
                  <span className="sr-only"> ({LEVEL_NAMES[node.depth - 1]})</span>
                </span>
                {node.archivedAt && <Badge variant="outline">Archived</Badge>}
                {!isHidden && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Move ${node.name} up`}
                      disabled={first || move.isPending}
                      onClick={() => move.mutate({ id: node.id, direction: 'up' })}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Move ${node.name} down`}
                      disabled={last || move.isPending}
                      onClick={() => move.mutate({ id: node.id, direction: 'down' })}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Manage ${node.name}`}
                  onClick={() => setManaging(node.id)}
                >
                  <Settings2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {managed && (
        <NodeDialog
          node={managed}
          nodes={nodes}
          onClose={() => setManaging(null)}
          onDeleted={() => setManaging(null)}
        />
      )}
    </>
  );
}

function AddTrackForm() {
  const id = useId();
  const [name, setName] = useState('');
  const add = useDataMutation(
    (ds, value: string) => ds.addNode({ parentId: null, name: value }),
    ['tree'],
    { onSuccess: () => setName('') },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) add.mutate(name.trim());
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Label htmlFor={`${id}-track`}>New track</Label>
      <div className="flex gap-2">
        <Input
          id={`${id}-track`}
          className="h-11"
          maxLength={60}
          placeholder="e.g. Piano"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={!name.trim() || add.isPending}>
          Add track
        </Button>
      </div>
    </form>
  );
}
