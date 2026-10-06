import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { NewTrackDialog } from '@/components/NewTrackDialog';
import { NodeLabel } from '@/components/NodeLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TreeNode } from '@/core/domain/types';
import { addDays } from '@/core/logic/dates';
import { formatDuration } from '@/core/logic/duration';
import { hiddenIds, sortSiblings } from '@/core/logic/tree';
import { MAX_NOTE_LENGTH, MAX_SESSION_MINUTES } from '@/core/schemas/inputs';
import { DAY_WARNING_MINUTES } from '@/core/services/sessions';
import { useDataMutation, useDay } from '@/data/queries';
import { cn } from '@/lib/utils';

// LOG-2–5, 7, 8, 10: the form behind "+ Log", also used to edit a session in History (HIST-2).

export interface LogFormValues {
  nodeId: string;
  studiedOn: string;
  minutes: number;
  note: string;
}

const DURATION_CHIPS = [15, 30, 45, 60, 90, 120];

/** The track picker's "+ Add new track…" choice, which opens the new track's settings. */
const NEW_TRACK = 'new-track';

interface Props {
  nodes: readonly TreeNode[];
  today: string;
  initial?: Partial<LogFormValues>;
  /** LOG-7 shortcuts; left out when editing. */
  recentNodeIds?: readonly string[];
  /** When editing, the session's current minutes and date, so the day total doesn't count it twice. */
  editing?: { minutes: number; studiedOn: string };
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: LogFormValues) => void;
}

/** The track, subtask, and topic ids along a node's path. */
function pathIds(nodes: readonly TreeNode[], nodeId: string | undefined): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ids: string[] = [];
  for (
    let n = nodeId ? byId.get(nodeId) : undefined;
    n;
    n = n.parentId ? byId.get(n.parentId) : undefined
  ) {
    ids.unshift(n.id);
  }
  return ids;
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'default' : 'outline'}
      aria-pressed={pressed}
      className="h-11 min-w-14"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function LogForm({
  nodes,
  today,
  initial = {},
  recentNodeIds = [],
  editing,
  submitLabel,
  pending,
  onSubmit,
}: Props) {
  const ids = useId();
  const initialPath = pathIds(nodes, initial.nodeId);
  const [trackId, setTrackId] = useState(initialPath[0] ?? '');
  const [subtaskId, setSubtaskId] = useState(initialPath[1] ?? '');
  const [topicId, setTopicId] = useState(initialPath[2] ?? '');
  const [studiedOn, setStudiedOn] = useState(initial.studiedOn ?? today);
  const initialMinutes = initial.minutes ?? 0;
  const [hours, setHours] = useState(initialMinutes ? String(Math.floor(initialMinutes / 60)) : '');
  const [mins, setMins] = useState(initialMinutes ? String(initialMinutes % 60) : '');
  const [note, setNote] = useState(initial.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTrackOpen, setNewTrackOpen] = useState(false);

  // Only visible nodes can be picked, plus the session's own path when editing an archived one.
  const pickable = useMemo(() => {
    const hidden = hiddenIds(nodes);
    const keep = new Set(initialPath);
    return nodes.filter((n) => !hidden.has(n.id) || keep.has(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the initial path is fixed per form
  }, [nodes]);
  const childrenOf = (parentId: string | null) =>
    sortSiblings(pickable.filter((n) => n.parentId === parentId));
  const tracks = childrenOf(null);
  const subtasks = trackId ? childrenOf(trackId) : [];
  const topics = subtaskId ? childrenOf(subtaskId) : [];

  const nodeId = topicId || subtaskId || trackId;
  const totalMinutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const minutesValid =
    Number.isInteger(totalMinutes) && totalMinutes >= 1 && totalMinutes <= MAX_SESSION_MINUTES;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(studiedOn) && studiedOn <= today;

  const errors = {
    node: nodeId ? null : 'Choose what you studied.',
    date: dateValid
      ? null
      : studiedOn > today
        ? 'You can’t log time in the future.'
        : 'Choose a date.',
    minutes: minutesValid ? null : 'Enter between 1 minute and 24 hours.',
    note:
      note.length > MAX_NOTE_LENGTH ? `Notes can be at most ${MAX_NOTE_LENGTH} characters.` : null,
  };
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null);

  // LOG-10: a soft warning when the day would go over 16 hours.
  const day = useDay(studiedOn, dateValid);
  const dayTotal =
    (day.data?.days[0]?.totalMinutes ?? 0) -
    (editing && editing.studiedOn === studiedOn ? editing.minutes : 0);
  const overDay = dateValid && minutesValid && dayTotal + totalMinutes > DAY_WARNING_MINUTES;

  const addTopic = useDataMutation(
    (ds, name: string) => ds.addNode({ parentId: subtaskId, name }),
    ['tree'],
    {
      onSuccess: (topic) => {
        setTopicId(topic.id);
        setNewTopicOpen(false);
        setNewTopicName('');
      },
    },
  );

  // Not selectNode: the tree in hand doesn't have the new track yet.
  function trackCreated(track: TreeNode) {
    setTrackId(track.id);
    setSubtaskId('');
    setTopicId('');
    setNewTrackOpen(false);
  }

  function selectNode(id: string) {
    const [track = '', subtask = '', topic = ''] = pathIds(nodes, id);
    setTrackId(track);
    setSubtaskId(subtask);
    setTopicId(topic);
  }

  function setDuration(total: number) {
    setHours(String(Math.floor(total / 60)));
    setMins(String(total % 60));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSubmit({ nodeId, studiedOn, minutes: totalMinutes, note: note.trim() });
  }

  const describe = (key: keyof typeof errors) =>
    show(key) ? { 'aria-invalid': true, 'aria-describedby': `${ids}-${key}-error` } : {};
  const errorText = (key: keyof typeof errors) =>
    show(key) && (
      <p id={`${ids}-${key}-error`} className="text-sm text-destructive">
        {show(key)}
      </p>
    );

  const recent = recentNodeIds.filter((id) => pickable.some((n) => n.id === id));

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {recent.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Recent</legend>
          <div className="flex flex-wrap gap-2">
            {recent.map((id) => (
              <Button
                key={id}
                type="button"
                variant={id === nodeId ? 'default' : 'outline'}
                aria-pressed={id === nodeId}
                className="h-11 max-w-full"
                onClick={() => selectNode(id)}
              >
                <NodeLabel nodes={nodes} nodeId={id} truncate />
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">What did you study?</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${ids}-track`}>Track</Label>
          <NativeSelect
            id={`${ids}-track`}
            value={trackId}
            onChange={(e) => {
              // "Add new track" opens its settings; the current choice stays until it's created.
              if (e.target.value === NEW_TRACK) setNewTrackOpen(true);
              else selectNode(e.target.value);
            }}
            {...describe('node')}
          >
            <option value="">Choose a track…</option>
            {tracks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
            <option value={NEW_TRACK}>+ Add new track…</option>
          </NativeSelect>
          {errorText('node')}
        </div>
        {subtasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-subtask`}>Subtask (optional)</Label>
            <NativeSelect
              id={`${ids}-subtask`}
              value={subtaskId}
              onChange={(e) => {
                setSubtaskId(e.target.value);
                setTopicId('');
                setNewTopicOpen(false);
              }}
            >
              <option value="">Whole track</option>
              {subtasks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {subtaskId && (
          <div className="flex flex-col gap-2">
            {topics.length > 0 && (
              <>
                <Label htmlFor={`${ids}-topic`}>Topic (optional)</Label>
                <NativeSelect
                  id={`${ids}-topic`}
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                >
                  <option value="">Whole subtask</option>
                  {topics.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </NativeSelect>
              </>
            )}
            {newTopicOpen ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${ids}-new-topic`}>New topic name</Label>
                <div className="flex gap-2">
                  <Input
                    id={`${ids}-new-topic`}
                    className="h-11"
                    maxLength={60}
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter adds the topic instead of submitting the whole form.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newTopicName.trim()) addTopic.mutate(newTopicName.trim());
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className="h-11"
                    disabled={!newTopicName.trim() || addTopic.isPending}
                    onClick={() => addTopic.mutate(newTopicName.trim())}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="h-11 self-start"
                onClick={() => setNewTopicOpen(true)}
              >
                + New topic
              </Button>
            )}
          </div>
        )}
        <NewTrackDialog
          nodes={nodes}
          open={newTrackOpen}
          onOpenChange={setNewTrackOpen}
          onCreated={trackCreated}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">When?</legend>
        <div className="flex flex-wrap items-end gap-2">
          <Chip pressed={studiedOn === today} onClick={() => setStudiedOn(today)}>
            Today
          </Chip>
          <Chip
            pressed={studiedOn === addDays(today, -1)}
            onClick={() => setStudiedOn(addDays(today, -1))}
          >
            Yesterday
          </Chip>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${ids}-date`} className="sr-only">
              Date
            </Label>
            <Input
              id={`${ids}-date`}
              type="date"
              className="h-11 w-auto"
              max={today}
              value={studiedOn}
              onChange={(e) => setStudiedOn(e.target.value)}
              {...describe('date')}
            />
          </div>
        </div>
        {errorText('date')}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How long?</legend>
        <div className="flex flex-wrap gap-2">
          {DURATION_CHIPS.map((chip) => (
            <Chip key={chip} pressed={totalMinutes === chip} onClick={() => setDuration(chip)}>
              {formatDuration(chip).replace('1h 30m', '1.5h')}
            </Chip>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`${ids}-hours`}>Hours</Label>
            <Input
              id={`${ids}-hours`}
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              className="h-11"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              {...describe('minutes')}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`${ids}-minutes`}>Minutes</Label>
            <Input
              id={`${ids}-minutes`}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              className="h-11"
              value={mins}
              onChange={(e) => setMins(e.target.value)}
              {...describe('minutes')}
            />
          </div>
        </div>
        {errorText('minutes')}
        {overDay && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            That makes {formatDuration(dayTotal + totalMinutes)} on this day — more than 16 hours.
            Double-check before saving.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${ids}-note`}>Note (optional)</Label>
        <Textarea
          id={`${ids}-note`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          {...describe('note')}
        />
        <p
          className={cn(
            'text-right text-xs text-muted-foreground',
            note.length > MAX_NOTE_LENGTH && 'text-destructive',
          )}
        >
          {note.length} / {MAX_NOTE_LENGTH}
        </p>
        {errorText('note')}
      </div>

      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
