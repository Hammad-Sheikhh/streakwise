import { toast } from 'sonner';

import { nodePath } from '@/core/logic/tree';
import { useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';

import { startTimer, useRunningTimer } from './timerStore.js';

/** Starts a timer on a node, unless one is already running (one at a time). */
export function useStartTimer() {
  const ds = useDataSource();
  const running = useRunningTimer();
  const tree = useTree();
  return (nodeId: string) => {
    const name = (id: string) => nodePath(tree.data ?? [], id).at(-1) ?? 'something';
    if (running) {
      toast.error(`A timer is already running on ${name(running.nodeId)}. Stop it first.`);
      return false;
    }
    startTimer(ds.mode, nodeId, ds.now());
    toast.success(`Timer started on ${name(nodeId)}.`);
    return true;
  };
}
