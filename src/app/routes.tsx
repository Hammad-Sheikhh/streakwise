import { Navigate, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';

import { LoginPage } from '@/app/LoginPage';
import { RequireAuth } from '@/app/RequireAuth';
import type { DataSource } from '@/data/DataSource';
import { DataSourceProvider } from '@/data/DataSourceContext';
import { HomePage } from '@/features/dashboard/HomePage';
import { DemoLayout } from '@/features/demo/DemoLayout';

// The app's pages; demo mode mounts the same pages under /demo (SPEC §B6).
const appPages: RouteObject[] = [{ index: true, element: <HomePage /> }];

export function createRoutes(apiDataSource: DataSource): RouteObject[] {
  return [
    {
      element: (
        <DataSourceProvider dataSource={apiDataSource}>
          <Outlet />
        </DataSourceProvider>
      ),
      children: [
        { path: 'login', element: <LoginPage /> },
        { element: <RequireAuth />, children: appPages },
      ],
    },
    { path: 'demo', element: <DemoLayout />, children: appPages },
    { path: '*', element: <Navigate to="/" replace /> },
  ];
}
