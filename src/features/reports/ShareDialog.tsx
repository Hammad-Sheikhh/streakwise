import { Copy } from 'lucide-react';
import { useId, useState } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
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
import type { SharedReportLink } from '@/core/domain/types';
import type { ReportQuery } from '@/core/schemas/inputs';
import { useDataMutation } from '@/data/queries';
import { copyText } from '@/lib/clipboard';
import { shareUrl } from '@/lib/shareUrl';

// SHARE-1, SHARE-5/6: make a public link to a frozen copy of the report as shown.

type Expiry = '7' | '30' | 'never';

export function ShareDialog({ query, onClose }: { query: ReportQuery; onClose: () => void }) {
  const id = useId();
  const [expiry, setExpiry] = useState<Expiry>('30');
  const [link, setLink] = useState<SharedReportLink | null>(null);
  const create = useDataMutation(
    (ds, input: Parameters<typeof ds.createShare>[0]) => ds.createShare(input),
    ['shares'],
    { onSuccess: (created) => setLink(created) },
  );

  function handleCreate() {
    create.mutate({
      report: query,
      expiresInDays: expiry === 'never' ? null : expiry === '7' ? 7 : 30,
    });
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>
            Anyone with the link can see this report (and nothing else). Later changes to your data
            don’t change it. You can revoke it in Settings → Shared links.
            {query.includeNotes && ' Your notes are included.'}
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-url`}>Link</Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-url`}
                readOnly
                className="h-11"
                value={shareUrl(link.slug)}
                onFocus={(e) => e.target.select()}
              />
              <Button
                className="h-11"
                onClick={() => void copyText(shareUrl(link.slug), 'Link copied.')}
              >
                <Copy aria-hidden="true" /> Copy
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-expiry`}>Link expires</Label>
              <NativeSelect
                id={`${id}-expiry`}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as Expiry)}
              >
                <option value="7">After 7 days</option>
                <option value="30">After 30 days</option>
                <option value="never">Never</option>
              </NativeSelect>
            </div>
            <Button className="h-11 self-start" disabled={create.isPending} onClick={handleCreate}>
              {create.isPending ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
