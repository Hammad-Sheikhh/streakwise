import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { useDataSource } from '@/data/useDataSource';

/** A screen whose milestone hasn't been built yet, so the navigation never leads nowhere. */
export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </>
  );
}

/** Mobile "More": the screens that don't fit in the bottom nav (SPEC §B6). */
export function MorePage() {
  const { basePath } = useDataSource();
  const links = [
    { to: '/history', label: 'History' },
    { to: '/scores', label: 'Scores' },
    { to: '/tracks', label: 'Tracks' },
    { to: '/settings', label: 'Settings' },
  ];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">More</h1>
      <ul className="flex flex-col divide-y rounded-lg border">
        {links.map(({ to, label }) => (
          <li key={to}>
            <Link
              to={`${basePath}${to}`}
              className="flex h-12 items-center justify-between px-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {label}
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
