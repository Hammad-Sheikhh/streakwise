import { useId } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SessionSource, TreeNode } from '@/core/domain/types';
import type { HistoryQuery } from '@/core/schemas/inputs';

// HIST-3: node (with descendants), source, and date range. Archived nodes stay filterable,
// because their history still counts.
export function HistoryFilters({
  nodes,
  filters,
  today,
  onChange,
}: {
  nodes: readonly TreeNode[];
  filters: HistoryQuery;
  today: string;
  onChange: (filters: HistoryQuery) => void;
}) {
  const id = useId();
  const active = Object.keys(filters).length > 0;

  return (
    <details className="rounded-lg border p-4" open={active}>
      <summary className="cursor-pointer text-sm font-medium">
        Filters{active ? ' (on)' : ''}
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-node`}>Subject</Label>
          <NativeSelect
            id={`${id}-node`}
            value={filters.nodeId ?? ''}
            onChange={(e) => onChange({ ...filters, nodeId: e.target.value || undefined })}
          >
            <option value="">Everything</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {'  '.repeat(n.depth - 1)}
                {n.name}
                {n.archivedAt ? ' (archived)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-source`}>Logged from</Label>
          <NativeSelect
            id={`${id}-source`}
            value={filters.source ?? ''}
            onChange={(e) =>
              onChange({ ...filters, source: (e.target.value || undefined) as SessionSource })
            }
          >
            <option value="">Anywhere</option>
            <option value="app">The app</option>
            <option value="claude">Claude</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-from`}>From</Label>
          <Input
            id={`${id}-from`}
            type="date"
            className="h-11"
            max={filters.to ?? today}
            value={filters.from ?? ''}
            onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-to`}>To</Label>
          <Input
            id={`${id}-to`}
            type="date"
            className="h-11"
            min={filters.from}
            max={today}
            value={filters.to ?? ''}
            onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
          />
        </div>
      </div>
      {active && (
        <Button variant="ghost" className="mt-4 h-11" onClick={() => onChange({})}>
          Clear filters
        </Button>
      )}
    </details>
  );
}
