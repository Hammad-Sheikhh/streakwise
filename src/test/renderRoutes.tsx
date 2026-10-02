import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createRoutes } from '@/app/routes';
import type { DataSource } from '@/data/DataSource';

/** Renders the real route tree at `path`, with a fake data source standing in for the API. */
export function renderRoutes(path: string, apiDataSource: DataSource) {
  const router = createMemoryRouter(createRoutes(apiDataSource), { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}
