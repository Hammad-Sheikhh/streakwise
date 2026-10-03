import { Navigate, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { LoginPage } from '@/app/LoginPage';
import { RequireAuth } from '@/app/RequireAuth';
import { ComingSoonPage, MorePage } from '@/app/SimplePages';
import type { DataSource } from '@/data/DataSource';
import { DataSourceProvider } from '@/data/DataSourceContext';
import { HomePage } from '@/features/dashboard/HomePage';
import { DemoLayout } from '@/features/demo/DemoLayout';
import { HistoryPage } from '@/features/history/HistoryPage';
import { LogPage } from '@/features/log/LogPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StructurePage } from '@/features/settings/StructurePage';

// The app's pages; demo mode mounts the same pages under /demo (SPEC §B6).
const appPages: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'log', element: <LogPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/structure', element: <StructurePage /> },
      {
        path: 'tasks',
        element: (
          <ComingSoonPage
            title="Tasks"
            description="Tasks and weekly to-dos arrive in a later update."
          />
        ),
      },
      {
        path: 'scores',
        element: (
          <ComingSoonPage
            title="Scores"
            description="Past papers, quizzes, and charts arrive in a later update."
          />
        ),
      },
      {
        path: 'tracks',
        element: (
          <ComingSoonPage title="Tracks" description="Track pages arrive in a later update." />
        ),
      },
      {
        path: 'reports',
        element: (
          <ComingSoonPage
            title="Reports"
            description="Printable and shareable reports arrive in a later update."
          />
        ),
      },
    ],
  },
];

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
