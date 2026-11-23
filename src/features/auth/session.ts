import type { QueryClient } from '@tanstack/react-query';

// The "is this device logged in?" query that RequireAuth reads. Auth pages write the new answer
// into the cache before navigating, so the guard never decides on a stale answer (which made the
// first login attempt bounce straight back to /login when the app had already checked the session).

export const sessionKey = (mode: string) => [mode, 'session'] as const;

export function rememberSession(
  queryClient: QueryClient,
  mode: string,
  authenticated: boolean,
): void {
  queryClient.setQueryData(sessionKey(mode), authenticated);
}
