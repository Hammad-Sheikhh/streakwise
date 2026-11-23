import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { watchInstallPrompt } from '@/lib/installPrompt';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// PWA-1: a browser that can install the app offers it in Settings; a shortcut from the browser
// menu is not the same thing (Android marks those with a small Chrome badge).
describe('installing the app', () => {
  it('shows nothing when the browser has not offered an install', async () => {
    renderRoutes('/settings', fakeApi({ loggedIn: true }));
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('installs from Settings when the browser offers it', async () => {
    const user = userEvent.setup();
    watchInstallPrompt();
    const prompt = vi.fn().mockResolvedValue(undefined);
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'android' }),
      }),
    );

    renderRoutes('/settings', fakeApi({ loggedIn: true }));
    await user.click(await screen.findByRole('button', { name: 'Install app' }));

    expect(prompt).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument(),
    );
  });
});
