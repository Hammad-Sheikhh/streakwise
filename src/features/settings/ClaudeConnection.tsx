import { Check, Copy } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_TIME_ZONE } from '@/core/logic/dates';
import { useClaudeConnection } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';

const lastCallFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: APP_TIME_ZONE,
});

/** Shows where the URL points without revealing the secret part (SET-4). */
function maskMcpUrl(url: string): string {
  const { origin } = new URL(url);
  return `${origin}/mcp/••••••••`;
}

// SET-4, ACCT-8: the user's own Claude link (made here, copied once), setup steps, and Claude's
// last call.
export function ClaudeConnectionSection() {
  const dataSource = useDataSource();

  return (
    <section aria-labelledby="claude-heading" className="flex flex-col gap-4">
      <h2 id="claude-heading" className="text-lg font-medium">
        Claude connection
      </h2>
      {dataSource.mode === 'demo' ? (
        <p className="text-sm text-muted-foreground">
          Not available in the demo: demo data lives only in this browser, so Claude can’t reach it.
        </p>
      ) : (
        <ConnectionDetails />
      )}
    </section>
  );
}

function ConnectionDetails() {
  const connection = useClaudeConnection();
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => {
      if (!dataSource.account) throw new Error('Not available in the demo');
      return dataSource.account.createClaudeLink();
    },
    onSuccess: (data) => queryClient.setQueryData([dataSource.mode, 'claude-connection'], data),
    onError: (error) => toast.error(error.message),
  });

  if (connection.isPending) return <Skeleton className="h-48 w-full" />;
  if (connection.isError) {
    return <QueryError error={connection.error} onRetry={() => void connection.refetch()} />;
  }

  const { hasLink, lastMcpCallAt } = connection.data;
  // ACCT-8: only a hash is stored, so the full link exists only in the answer that created it.
  const url = create.data?.url ?? null;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Connector URL copied. Keep it private: it works like a password.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy. Your browser blocked access to the clipboard.');
    }
  }

  function makeLink() {
    if (
      hasLink &&
      !window.confirm('Make a new link? The old one stops working, so Claude needs the new one.')
    ) {
      return;
    }
    create.mutate();
  }

  return (
    <div className="flex flex-col gap-4">
      {url ? (
        <div className="flex flex-col gap-2">
          <span id="claude-url-label" className="text-sm font-medium">
            Your connector URL
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <code
              aria-labelledby="claude-url-label"
              className="min-w-0 rounded-md border bg-muted px-3 py-2 text-sm break-all"
            >
              {maskMcpUrl(url)}
            </code>
            <Button variant="outline" className="h-11" onClick={() => void copy(url)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy URL'}
            </Button>
          </div>
          <p role="status" className="text-sm font-medium">
            Copy it now: for your safety it’s shown only this once.
          </p>
          <p className="text-sm text-muted-foreground">
            Anyone with this URL can read and change your study data, so don’t share it.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {hasLink
              ? 'Your link is set up. It was shown only once; if you’ve lost it, make a new one.'
              : 'Make your own private link, then add it to Claude.'}
          </p>
          <Button variant="outline" className="h-11" onClick={makeLink} disabled={create.isPending}>
            {hasLink ? 'Make a new link' : 'Create Claude link'}
          </Button>
        </div>
      )}

      <p className="text-sm">
        <span className="font-medium">Last used by Claude: </span>
        {lastMcpCallAt ? lastCallFormat.format(new Date(lastMcpCallAt)) : 'never'}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">How to connect</h3>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>Create your link above and copy it.</li>
          <li>
            In Claude (claude.ai or the app), open <strong>Customize → Connectors</strong>, then
            choose <strong>+ Add → Add custom connector</strong>.
          </li>
          <li>
            Name it <strong>Streakwise</strong>, paste the URL, and select <strong>Continue</strong>
            .
          </li>
          <li>
            For authentication, choose <strong>No sign in</strong>, then select <strong>Add</strong>
            .
          </li>
          <li>
            In a chat, select <strong>+ → Connectors</strong> and turn on Streakwise. Then ask, for
            example, “Log 45 minutes of Maths for today.”
          </li>
        </ol>
      </div>
    </div>
  );
}
