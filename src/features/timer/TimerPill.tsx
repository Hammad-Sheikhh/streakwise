import { Square, Timer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatElapsed, timedSession } from '@/core/logic/timer';
import { nodePath } from '@/core/logic/tree';
import { useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useStudyDay } from '@/data/useToday';

import { clearTimer, useRunningTimer } from './timerStore.js';

// TIMER-1, TIMER-2: the running timer's pill (above the bottom nav on phones, in the corner on
// desktop). Stop opens the Log form filled in; Discard drops it without saving.

export function TimerPill() {
  const ds = useDataSource();
  const navigate = useNavigate();
  const running = useRunningTimer();
  const tree = useTree();
  const { dayEndsAtMinutes } = useStudyDay();
  const [now, setNow] = useState(() => ds.now());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(ds.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running, ds]);

  if (!running || !tree.data) return null;
  const node = tree.data.find((n) => n.id === running.nodeId);
  const name = node ? nodePath(tree.data, node.id).join(' › ') : 'Deleted item';
  const elapsed = formatElapsed(now.getTime() - Date.parse(running.startedAt));

  function stop() {
    if (!running) return;
    const session = timedSession(running.startedAt, ds.now(), dayEndsAtMinutes);
    const params = new URLSearchParams({
      minutes: String(session.minutes),
      date: session.studiedOn,
      timer: '1',
    });
    if (node) params.set('node', node.id);
    if (session.overLimit) params.set('ran', String(session.elapsedMinutes));
    clearTimer(ds.mode);
    void navigate(`${ds.basePath}/log?${params.toString()}`);
  }

  return (
    <div
      role="region"
      aria-label="Timer"
      className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full border bg-background p-1.5 pl-4 shadow-md md:inset-x-auto md:right-6 md:bottom-6 print:hidden"
    >
      <Timer aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="sr-only">Running on </span>
        {name}
      </span>
      <span className="shrink-0 text-sm font-medium tabular-nums" aria-label={`Elapsed ${elapsed}`}>
        {elapsed}
      </span>
      {confirming ? (
        <>
          <Button
            variant="destructive"
            className="h-11 rounded-full"
            onClick={() => {
              clearTimer(ds.mode);
              setConfirming(false);
              toast.success('Timer discarded.');
            }}
          >
            Discard
          </Button>
          <Button
            variant="ghost"
            className="h-11 rounded-full"
            onClick={() => setConfirming(false)}
          >
            Keep
          </Button>
        </>
      ) : (
        <>
          <Button className="h-11 rounded-full" onClick={stop}>
            <Square aria-hidden="true" /> Stop
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full"
            aria-label="Discard the timer"
            onClick={() => setConfirming(true)}
          >
            <X aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  );
}
