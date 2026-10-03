import { Button } from '@/components/ui/button';

/** A failed load, with a way to try again (SPEC §B11: no blank screens). */
export function QueryError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-4"
    >
      <p>{error.message}</p>
      <Button variant="outline" className="h-11" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
