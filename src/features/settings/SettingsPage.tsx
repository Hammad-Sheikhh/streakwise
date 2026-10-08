import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { NativeSelect } from '@/components/NativeSelect';
import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { Settings } from '@/core/domain/types';
import { useDataMutation, useSettings } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';

import { AccountSection } from './AccountSection';
import { ClaudeConnectionSection } from './ClaudeConnection';
import { ExportSection } from './ExportSection';

const SECTIONS = [
  { path: 'structure', title: 'Structure', description: 'Tracks, subtasks, and topics' },
  { path: 'targets', title: 'Weekly targets', description: 'Hours per week for each track' },
  { path: 'deadlines', title: 'Deadlines', description: 'Exams and due dates' },
  { path: 'shared-links', title: 'Shared links', description: 'Report links you’ve shared' },
];

// SET-1: the Settings shell, with shared links (SHARE-3) and export (SET-2/3).
export function SettingsPage() {
  const dataSource = useDataSource();
  const settings = useSettings();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section aria-labelledby="general-heading" className="flex flex-col gap-4">
        <h2 id="general-heading" className="text-lg font-medium">
          General
        </h2>
        {settings.isPending && <Skeleton className="h-40 w-full" />}
        {settings.isError && (
          <QueryError error={settings.error} onRetry={() => void settings.refetch()} />
        )}
        {settings.data && <GeneralForm settings={settings.data} />}
      </section>

      <section aria-labelledby="sections-heading" className="flex flex-col gap-4">
        <h2 id="sections-heading" className="text-lg font-medium">
          Your study plan
        </h2>
        <ul className="flex flex-col divide-y rounded-lg border">
          {SECTIONS.map((section) => (
            <li key={section.path}>
              <Link
                to={`${dataSource.basePath}/settings/${section.path}`}
                className="flex min-h-14 items-center justify-between px-4 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span>
                  <span className="block font-medium">{section.title}</span>
                  <span className="block text-sm text-muted-foreground">{section.description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ExportSection />

      <ClaudeConnectionSection />

      <AccountSection />
    </>
  );
}

function GeneralForm({ settings }: { settings: Settings }) {
  const id = useId();
  const [studentName, setStudentName] = useState(settings.studentName);
  const [neglectDays, setNeglectDays] = useState(settings.neglectDays);
  const save = useDataMutation(
    (ds, input: { studentName: string; neglectDays: number }) => ds.updateSettings(input),
    ['settings'],
    { onSuccess: () => toast.success('Settings saved.') },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ studentName, neglectDays });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Student name</Label>
        <Input
          id={`${id}-name`}
          className="h-11"
          maxLength={80}
          autoComplete="name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          aria-describedby={`${id}-name-help`}
        />
        <p id={`${id}-name-help`} className="text-sm text-muted-foreground">
          Shown at the top of your reports.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-neglect`}>Warn me when something is untouched for</Label>
        <NativeSelect
          id={`${id}-neglect`}
          className="sm:w-48"
          value={neglectDays}
          onChange={(e) => setNeglectDays(Number(e.target.value))}
        >
          {Array.from({ length: 14 }, (_, i) => i + 1).map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? 'day' : 'days'}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" className="h-11 self-start" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
