import { useQuery } from '@tanstack/react-query';
import { ClipboardCopy, Link2, MessageSquareText, Printer } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MAX_REPORT_DAYS } from '@/core/domain/types';
import type { Report, ReportPeriodKind } from '@/core/domain/types';
import { addDays, localDate } from '@/core/logic/dates';
import { reportAsMarkdown, reportAsWhatsApp } from '@/core/logic/reportFormat';
import type { ReportQuery } from '@/core/schemas/inputs';
import { useDataMutation, useSettings } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';

import { ReportView } from './ReportView';
import { ShareDialog } from './ShareDialog';

// REP-1–8: pick a period, see the report, then print it, copy it, or share a link.

const PERIODS: { kind: ReportPeriodKind; label: string }[] = [
  { kind: 'today', label: 'Today' },
  { kind: 'yesterday', label: 'Yesterday' },
  { kind: 'this_week', label: 'This week' },
  { kind: 'last_week', label: 'Last week' },
  { kind: 'custom', label: 'Custom' },
];

export function ReportsPage() {
  const ds = useDataSource();
  const id = useId();
  const today = localDate(ds.now());
  const [period, setPeriod] = useState<ReportPeriodKind>('this_week');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [includeNotes, setIncludeNotes] = useState(false);

  const query: ReportQuery =
    period === 'custom' ? { period, from, to, includeNotes } : { period, includeNotes };
  const customValid = period !== 'custom' || (from !== '' && to !== '' && from <= to);
  const report = useQuery({
    queryKey: [ds.mode, 'report', query],
    queryFn: () => ds.buildReport(query),
    enabled: customValid,
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight print:hidden">Reports</h1>

      <div className="flex flex-col gap-4 print:hidden">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Period</legend>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.kind}
                type="button"
                variant={period === p.kind ? 'default' : 'outline'}
                className="h-11"
                aria-pressed={period === p.kind}
                onClick={() => setPeriod(p.kind)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </fieldset>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-from`}>From</Label>
              <Input
                id={`${id}-from`}
                type="date"
                className="h-11"
                value={from}
                max={today}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-to`}>To</Label>
              <Input
                id={`${id}-to`}
                type="date"
                className="h-11"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">Up to {MAX_REPORT_DAYS} days.</p>
          </div>
        )}

        <label className="flex min-h-11 items-center gap-3 self-start">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
          />
          Include notes
        </label>
      </div>

      <NamePrompt />

      {!customValid && (
        <p role="alert" className="text-sm text-destructive">
          Choose a start date on or before the end date.
        </p>
      )}
      {customValid && report.isPending && <Skeleton className="h-96 w-full" />}
      {report.isError && <QueryError error={report.error} onRetry={() => void report.refetch()} />}
      {report.data && (
        <>
          <ReportActions report={report.data} query={query} />
          <ReportView report={report.data} />
        </>
      )}
    </>
  );
}

function ReportActions({ report, query }: { report: Report; query: ReportQuery }) {
  const ds = useDataSource();
  const [sharing, setSharing] = useState(false);
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" onClick={() => window.print()}>
          <Printer aria-hidden="true" /> Print / Save as PDF
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => void copyText(reportAsWhatsApp(report), 'Copied for WhatsApp.')}
        >
          <MessageSquareText aria-hidden="true" /> Copy as text
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => void copyText(reportAsMarkdown(report), 'Copied for Claude.')}
        >
          <ClipboardCopy aria-hidden="true" /> Copy for Claude
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={ds.mode === 'demo'}
          onClick={() => setSharing(true)}
        >
          <Link2 aria-hidden="true" /> Share link
        </Button>
      </div>
      {ds.mode === 'demo' && (
        <p className="text-sm text-muted-foreground">
          Share links are off in the demo, because demo data lives only in this browser.
        </p>
      )}
      {sharing && <ShareDialog query={query} onClose={() => setSharing(false)} />}
    </div>
  );
}

/** SPEC §B4: the student name is empty until the first report asks for it. */
function NamePrompt() {
  const settings = useSettings();
  const id = useId();
  const [name, setName] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const save = useDataMutation(
    (ds, studentName: string) => ds.updateSettings({ studentName }),
    ['settings', 'report'],
    { onSuccess: () => toast.success('Name saved.') },
  );
  if (dismissed || !settings.data || settings.data.studentName !== '') return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) save.mutate(name.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 print:hidden')}
    >
      <Label htmlFor={`${id}-name`}>What name should your reports show?</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-name`}
          className="h-11 max-w-xs"
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" className="h-11" disabled={save.isPending || !name.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </div>
    </form>
  );
}
