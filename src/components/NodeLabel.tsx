import type { TreeNode } from '@/core/domain/types';
import { nodePath, trackOf } from '@/core/logic/tree';
import { cn } from '@/lib/utils';

import { trackSwatchClass } from './trackColors';

/** A node's path ("Improvement Exams › Maths") with its track's color swatch. */
export function NodeLabel({
  nodes,
  nodeId,
  className,
}: {
  nodes: readonly TreeNode[];
  nodeId: string;
  className?: string;
}) {
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
      <span className="truncate">{path.length > 0 ? path.join(' › ') : 'Deleted item'}</span>
    </span>
  );
}
