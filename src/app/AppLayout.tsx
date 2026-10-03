import {
  ChartLine,
  Ellipsis,
  FileText,
  History,
  House,
  Layers,
  ListChecks,
  Plus,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useDataSource } from '@/data/useDataSource';
import { cn } from '@/lib/utils';

// SPEC §B6: a bottom nav on mobile (Home · Tasks · + Log · Reports · More) and a sidebar on desktop.

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const MOBILE_ITEMS: NavItem[] = [
  { to: '', label: 'Home', icon: House },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/log', label: 'Log', icon: Plus },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/more', label: 'More', icon: Ellipsis },
];

const DESKTOP_ITEMS: NavItem[] = [
  { to: '', label: 'Home', icon: House },
  { to: '/history', label: 'History', icon: History },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/scores', label: 'Scores', icon: ChartLine },
  { to: '/tracks', label: 'Tracks', icon: Layers },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { basePath } = useDataSource();
  const home = basePath || '/';

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r p-4 md:flex">
        <Link to={home} className="px-2 text-lg font-semibold tracking-tight">
          Streakwise
        </Link>
        <Button asChild className="h-11">
          <Link to={`${basePath}/log`}>
            <Plus aria-hidden="true" /> Log a session
          </Link>
        </Button>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {DESKTOP_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to ? `${basePath}${to}` : home}
              end={to === ''}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pb-24 md:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MOBILE_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to ? `${basePath}${to}` : home}
            end={to === ''}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                isActive && 'font-medium text-foreground',
              )
            }
          >
            {to === '/log' ? (
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </span>
            ) : (
              <Icon aria-hidden="true" className="size-5" />
            )}
            {label}
          </NavLink>
        ))}
      </nav>
      <Toaster position="top-center" />
    </div>
  );
}
