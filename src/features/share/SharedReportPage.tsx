import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_NAME } from '@/core/logic/reportFormat';
import { fetchSharedReport } from '@/data/publicShare';
import { ReportView } from '@/features/reports/ReportView';

// SHARE-2, SHARE-4: a shared report on its own page: no navigation into the app, never indexed.
export function SharedReportPage() {
  const { slug = '' } = useParams();
  const report = useQuery({
    queryKey: ['public-share', slug],
    queryFn: () => fetchSharedReport(slug),
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* React places these in the document head. */}
      <meta name="robots" content="noindex, nofollow" />
      <title>{`Study report · ${APP_NAME}`}</title>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8 print:max-w-none print:p-0">
        {report.isPending && <Skeleton className="h-96 w-full" />}
        {report.isError && (
          <QueryError error={report.error} onRetry={() => void report.refetch()} />
        )}
        {report.data === null && (
          <div className="flex flex-col gap-2 rounded-lg border p-6">
            <h1 className="text-xl font-semibold">This report is no longer available.</h1>
            <p className="text-muted-foreground">
              The link may have expired or been turned off by the person who shared it.
            </p>
          </div>
        )}
        {report.data && <ReportView report={report.data} titleLevel={1} />}
        <footer className="text-center text-sm text-muted-foreground print:text-neutral-600">
          Made with {APP_NAME}
        </footer>
      </main>
    </div>
  );
}
