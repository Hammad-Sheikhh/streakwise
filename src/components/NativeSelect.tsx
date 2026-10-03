import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

// The browser's own <select>: on phones it opens the system picker, which is fast and accessible.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}
