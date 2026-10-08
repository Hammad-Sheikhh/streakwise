import type { TreeNode } from '@/core/domain/types';
import { nodePath, trackOf } from '@/core/logic/tree';
import { cn } from '@/lib/utils';

import { trackSwatchClass } from './trackColors';

/** A node's path ("School Subjects › Maths") with its track's color swatch. */
export function NodeLabel({
  nodes,
  nodeId,
  className,
  truncate = false,
}: {
  nodes: readonly TreeNode[];
  /** null = a task with no track ("Other"). */
  nodeId: string | null;
  className?: string;
  /** Cut long paths with "…" (for one-line chips); otherwise they wrap. */
  truncate?: boolean;
}) {
  if (nodeId === null) return <span className={className}>Other</span>;
  const track = trackOf(nodes, nodeId);
  const path = nodePath(nodes, nodeId);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {track?.color && (
        <span
          aria-hidden="true"
          className={cn('size-2.5 shrink-0 rounded-full', trackSwatchClass[track.color])}
        />
      )}
      <span className={truncate ? 'truncate' : 'break-words'}>
        {path.length > 0 ? path.join(' › ') : 'Deleted item'}
      </span>
    </span>
  );
}
