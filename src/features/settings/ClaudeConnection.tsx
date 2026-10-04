import { Check, Copy } from 'lucide-react';
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

// SET-4: setup steps, the connector URL (masked, with a copy button), and Claude's last call.
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
  const [copied, setCopied] = useState(false);

  if (connection.isPending) return <Skeleton className="h-48 w-full" />;
  if (connection.isError) {
    return <QueryError error={connection.error} onRetry={() => void connection.refetch()} />;
  }

  const { url, lastMcpCallAt } = connection.data;
  if (url === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Not set up yet: the server has no connection secret (<code>MCP_SECRET</code>).
      </p>
    );
  }

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id="claude-url-label" className="text-sm font-medium">
          Connector URL
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
        <p className="text-sm text-muted-foreground">
          Anyone with this URL can read and change your study data, so don’t share it.
        </p>
      </div>

      <p className="text-sm">
        <span className="font-medium">Last used by Claude: </span>
        {lastMcpCallAt ? lastCallFormat.format(new Date(lastMcpCallAt)) : 'never'}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">How to connect</h3>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>Copy the connector URL above.</li>
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
