import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { PlaceholderPage } from '@/app/PlaceholderPage';

const router = createBrowserRouter([{ path: '*', element: <PlaceholderPage /> }]);

export function App() {
  // One QueryClient per app instance, kept stable across re-renders.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
