import type { SelectHTMLAttributes } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import type { TreeNode } from '@/core/domain/types';
import { hiddenIds } from '@/core/logic/tree';

/**
 * Picks any visible track, subtask, or topic, indented by level (nodes in tree order). The
 * current value stays listed even if it has been archived since.
 */
export function NodeSelect({
  nodes,
  value,
  onChange,
  ...props
}: {
  nodes: readonly TreeNode[];
  value: string;
  onChange: (nodeId: string) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  const hidden = hiddenIds(nodes);
  const options = nodes.filter((n) => !hidden.has(n.id) || n.id === value);
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      <option value="">Choose…</option>
      {options.map((n) => (
        <option key={n.id} value={n.id}>
          {'  '.repeat(n.depth - 1)}
          {n.name}
        </option>
      ))}
    </NativeSelect>
  );
}
