import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet } from 'react-router';

import { Button } from '@/components/ui/button';
import { useDataSource } from '@/data/useDataSource';

/** Shows the page only with a valid session; otherwise sends the visitor to /login. */
export function RequireAuth() {
  const dataSource = useDataSource();
  const session = useQuery({
    queryKey: [dataSource.mode, 'session'],
    queryFn: () => dataSource.isAuthenticated(),
    retry: false,
  });

  if (session.isPending) {
    return (
      <p role="status" className="p-6 text-center text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (session.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 p-6 text-center">
        <p>{session.error.message}</p>
        <Button className="h-11" onClick={() => void session.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!session.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
