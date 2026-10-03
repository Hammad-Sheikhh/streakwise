import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

import { useDataSource } from '@/data/useDataSource';

/** The way back from a Settings section to Settings. */
export function BackToSettings() {
  const { basePath } = useDataSource();
  return (
    <Link
      to={`${basePath}/settings`}
      className="flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" /> Settings
    </Link>
  );
}
