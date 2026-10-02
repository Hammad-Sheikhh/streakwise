import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { trackSwatchClass } from '@/components/trackColors';
import { Button } from '@/components/ui/button';
import { useDataSource } from '@/data/useDataSource';

// A temporary Home: the structure tree and logout. The real dashboard arrives in M3.
export function HomePage() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tree = useQuery({
    queryKey: [dataSource.mode, 'tree'],
    queryFn: () => dataSource.listTree(),
  });

  const logout = useMutation({
    mutationFn: () => dataSource.logout(),
    onSuccess: () => {
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-4 text-foreground">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Streakwise</h1>
        {dataSource.mode === 'api' ? (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Log out
          </Button>
        ) : (
          <Button variant="outline" className="h-11" onClick={() => void navigate('/login')}>
            Exit demo
          </Button>
        )}
      </header>

      <section aria-labelledby="structure-heading" className="flex flex-col gap-3">
        <h2 id="structure-heading" className="text-lg font-medium">
          Your tracks
        </h2>
        {tree.isPending && <p role="status">Loading…</p>}
        {tree.isError && (
          <div role="alert" className="flex items-center gap-4">
            <p>{tree.error.message}</p>
            <Button className="h-11" onClick={() => void tree.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {tree.data && (
          <ul className="flex flex-col gap-1">
            {tree.data.map((node) => (
              <li
                key={node.id}
                className="flex items-center gap-2"
                style={{ paddingInlineStart: `${(node.depth - 1) * 1.5}rem` }}
              >
                {node.color && (
                  <span
                    aria-hidden="true"
                    className={`size-3 rounded-full ${trackSwatchClass[node.color]}`}
                  />
                )}
                <span className={node.depth === 1 ? 'font-medium' : 'text-muted-foreground'}>
                  {node.name}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Logging, history, and the dashboard are on the way.
        </p>
      </section>
    </main>
  );
}
