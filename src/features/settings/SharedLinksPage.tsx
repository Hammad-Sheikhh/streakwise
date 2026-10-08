import { Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryError } from '@/components/QueryError';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SharedReportLink } from '@/core/domain/types';
import { formatTimestamp } from '@/core/logic/labels';
import { shareStatus } from '@/core/services/shares';
import { useDataMutation, useShares } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { copyText } from '@/lib/clipboard';
import { shareUrl } from '@/lib/shareUrl';

import { BackToSettings } from './BackToSettings';

const STATUS_LABELS = { active: 'Active', expired: 'Expired', revoked: 'Revoked' } as const;

// SHARE-3: every link (period, created, expires) with Revoke.
export function SharedLinksPage() {
  const ds = useDataSource();
  return (
    <>
      <BackToSettings />
      <h1 className="text-2xl font-semibold tracking-tight">Shared links</h1>
      {ds.mode === 'demo' ? (
        <p className="text-muted-foreground">
          Share links are off in the demo, because demo data lives only in this browser.
        </p>
      ) : (
        <LinkList />
      )}
    </>
  );
}

function LinkList() {
  const ds = useDataSource();
  const shares = useShares();
  const [revoking, setRevoking] = useState<SharedReportLink | null>(null);
  const revoke = useDataMutation((d, id: string) => d.revokeShare(id), ['shares'], {
    onSuccess: () => toast.success('Link revoked. It no longer shows the report.'),
  });

  if (shares.isPending) return <Skeleton className="h-40 w-full" />;
  if (shares.isError) {
    return <QueryError error={shares.error} onRetry={() => void shares.refetch()} />;
  }
  if (shares.data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6">
        No shared links yet. Open Reports and choose “Share link” to make one.
      </p>
    );
  }

  const now = ds.now();
  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg border">
        {shares.data.map((link) => {
          const status = shareStatus(link, now);
          return (
            <li key={link.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {link.periodLabel}
                  <Badge variant={status === 'active' ? 'secondary' : 'outline'}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  Created {formatTimestamp(link.createdAt)} ·{' '}
                  {link.expiresAt
                    ? `${status === 'expired' ? 'Expired' : 'Expires'} ${formatTimestamp(link.expiresAt)}`
                    : 'Never expires'}
                </p>
              </div>
              {status === 'active' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => void copyText(shareUrl(link.slug), 'Link copied.')}
                  >
                    <Copy aria-hidden="true" /> Copy
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => setRevoking(link)}>
                    Revoke
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone who opens it will see “This report is no longer available.” This can’t be
              undone, but you can share a new link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                if (revoking) revoke.mutate(revoking.id);
                setRevoking(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
