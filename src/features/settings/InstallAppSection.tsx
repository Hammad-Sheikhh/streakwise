import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/lib/installPrompt';

// PWA-1: offers the real install (its own icon, no browser bar) when the browser can do it.
// "Add to home screen" only makes a shortcut, which Android marks with a small Chrome badge.
export function InstallAppSection() {
  const { state, install } = useInstallPrompt();
  if (state !== 'available') return null;

  return (
    <section aria-labelledby="install-heading" className="flex flex-col items-start gap-3">
      <h2 id="install-heading" className="text-lg font-medium">
        Install the app
      </h2>
      <p className="text-sm text-muted-foreground">
        Puts Streakwise on your home screen with its own icon and no browser bar. Use this rather
        than “Add to home screen”, which only makes a shortcut.
      </p>
      <Button variant="outline" className="h-11" onClick={() => void install()}>
        <Download aria-hidden="true" /> Install app
      </Button>
    </section>
  );
}
