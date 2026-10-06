import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@/components/NativeSelect';
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
import { Textarea } from '@/components/ui/textarea';
import { TRACK_COLORS } from '@/core/domain/types';
import type { TrackColor, TreeNode } from '@/core/domain/types';
import { nextTrackColor } from '@/core/services/structure';
import { useDataMutation } from '@/data/queries';
import { formatTargetHours, TARGET_OPTIONS } from '@/lib/format';
import { cn } from '@/lib/utils';

// A new track with its settings (TREE-1, TREE-4, TGT-1): name, color, weekly target, and any
// subtasks, opened from the Log screen's Track list.

interface NewTrackValues {
  name: string;
  color: TrackColor;
  weeklyTargetMinutes: number | null;
  subtasks: string[];
}

export function NewTrackDialog({
  nodes,
  open,
  onOpenChange,
  onCreated,
}: {
  nodes: readonly TreeNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (track: TreeNode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New track</DialogTitle>
          <DialogDescription>
            A subject or goal to log time on. You can change all of this later in Settings.
          </DialogDescription>
        </DialogHeader>
        {/* Re-mounted each time it opens, so the fields start fresh. */}
        {open && <NewTrackForm nodes={nodes} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function NewTrackForm({
  nodes,
  onCreated,
}: {
  nodes: readonly TreeNode[];
  onCreated: (track: TreeNode) => void;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TrackColor>(() => nextTrackColor(nodes));
  const [target, setTarget] = useState('');
  const [subtasks, setSubtasks] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const trimmed = name.trim();
  const nameError = !trimmed
    ? 'Enter a name.'
    : nodes.some((n) => n.depth === 1 && n.name.toLowerCase() === trimmed.toLowerCase())
      ? 'A track with that name already exists.'
      : null;

  // Several steps; if a later one fails, the track still exists and can be fixed in Settings.
  const create = useDataMutation(
    async (ds, values: NewTrackValues) => {
      const track = await ds.addNode({ parentId: null, name: values.name, color: values.color });
      if (values.weeklyTargetMinutes) {
        await ds.updateNode(track.id, { weeklyTargetMinutes: values.weeklyTargetMinutes });
      }
      for (const subtask of values.subtasks) {
        await ds.addNode({ parentId: track.id, name: subtask });
      }
      return track;
    },
    ['tree'],
    {
      onSuccess: (track) => {
        toast.success(`Added “${track.name}”.`);
        onCreated(track);
      },
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React passes events up through portals, so without this the Log form behind would submit too.
    event.stopPropagation();
    setSubmitted(true);
    if (nameError) return;
    const names = [
      ...new Map(
        subtasks
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => [s.toLowerCase(), s]),
      ).values(),
    ];
    create.mutate({
      name: trimmed,
      color,
      weeklyTargetMinutes: target ? Number(target) : null,
      subtasks: names,
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          className="h-11"
          maxLength={60}
          placeholder="e.g. Piano"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...(submitted && nameError
            ? { 'aria-invalid': true, 'aria-describedby': `${id}-name-error` }
            : {})}
        />
        {submitted && nameError && (
          <p id={`${id}-name-error`} className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {TRACK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                'flex size-11 items-center justify-center rounded-full border-2 border-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                color === c && 'border-foreground',
              )}
            >
              <span className={cn('size-7 rounded-full', trackSwatchClass[c])} />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-target`}>Weekly target (optional)</Label>
        <NativeSelect
          id={`${id}-target`}
          className="max-w-56"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">No target</option>
          {TARGET_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatTargetHours(minutes)} a week
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-subtasks`}>Subtasks (optional, one per line)</Label>
        <Textarea
          id={`${id}-subtasks`}
          placeholder={'e.g.\nTheory\nPractice'}
          value={subtasks}
          onChange={(e) => setSubtasks(e.target.value)}
        />
      </div>

      <Button type="submit" className="h-11 self-start" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Create track'}
      </Button>
    </form>
  );
}
