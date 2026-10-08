import { Navigate, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { MorePage } from '@/app/SimplePages';
import type { DataSource } from '@/data/DataSource';
import { DataSourceProvider } from '@/data/DataSourceContext';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { HomePage } from '@/features/dashboard/HomePage';
import { DemoLayout } from '@/features/demo/DemoLayout';
import { HistoryPage } from '@/features/history/HistoryPage';
import { LogPage } from '@/features/log/LogPage';
import { ScoresPage } from '@/features/scores/ScoresPage';
import { DeadlinesPage } from '@/features/settings/DeadlinesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SharedLinksPage } from '@/features/settings/SharedLinksPage';
import { StructurePage } from '@/features/settings/StructurePage';
import { TargetsPage } from '@/features/settings/TargetsPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TrackPage } from '@/features/tracks/TrackPage';
import { TracksPage } from '@/features/tracks/TracksPage';

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
      { path: 'settings/targets', element: <TargetsPage /> },
      { path: 'settings/deadlines', element: <DeadlinesPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'scores', element: <ScoresPage /> },
      { path: 'tracks', element: <TracksPage /> },
      { path: 'tracks/:id', element: <TrackPage /> },
      // Reports are lazy-loaded (SPEC §B11: performance).
      {
        path: 'reports',
        lazy: async () => ({
          Component: (await import('@/features/reports/ReportsPage')).ReportsPage,
        }),
      },
      { path: 'settings/shared-links', element: <SharedLinksPage /> },
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
        { path: 'signup', element: <SignUpPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
        { path: 'reset-password', element: <ResetPasswordPage /> },
        // SHARE-2: public, no login, no app navigation.
        {
          path: 'r/:slug',
          lazy: async () => ({
            Component: (await import('@/features/share/SharedReportPage')).SharedReportPage,
          }),
        },
        { element: <RequireAuth />, children: appPages },
      ],
    },
    { path: 'demo', element: <DemoLayout />, children: appPages },
    { path: '*', element: <Navigate to="/" replace /> },
  ];
}
