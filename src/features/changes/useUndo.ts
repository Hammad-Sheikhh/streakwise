import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import type { ChangeEntity } from '@/core/domain/types';
import { useDataSource } from '@/data/useDataSource';

/** UNDO-1: the Undo button stays this long. */
export const UNDO_TOAST_MS = 10_000;

/**
 * UNDO-1: shows a success toast with an Undo button. Undo finds the newest recorded change to
 * the item (UNDO-3) and undoes it (UNDO-5), so the Recent changes list shows it as undone. A
 * refusal (for example a later change to the same item) is shown as it comes from the server.
 */
export function useUndoToast() {
  const ds = useDataSource();
  const queryClient = useQueryClient();

  const undo = useCallback(
    async (entity: ChangeEntity, entityId: string) => {
      try {
        const changes = await ds.listChanges();
        const entry = changes.find(
          (c) => c.entity === entity && c.entityId === entityId && c.undoneAt === null,
        );
        if (!entry) throw new Error('There’s nothing left to undo here.');
        await ds.undoChange(entry.id);
        toast.success('Undone.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Couldn’t undo that.');
      } finally {
        // Anything can change on undo, so every cached screen refreshes.
        await queryClient.invalidateQueries({ queryKey: [ds.mode] });
      }
    },
    [ds, queryClient],
  );

  return useCallback(
    (message: string, entity: ChangeEntity, entityId: string) =>
      toast.success(message, {
        duration: UNDO_TOAST_MS,
        action: { label: 'Undo', onClick: () => void undo(entity, entityId) },
      }),
    [undo],
  );
}
