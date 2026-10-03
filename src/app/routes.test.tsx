import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

describe('login flow (AUTH-1)', () => {
  it('sends a logged-out visitor from Home to the login page', async () => {
    const { router } = renderRoutes('/', fakeApi());
    expect(await screen.findByLabelText('Passcode')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
  });

  it('shows a calm error for a wrong passcode and stays on the login page', async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes('/login', fakeApi());
    await user.type(await screen.findByLabelText('Passcode'), 'guess');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That passcode isn’t right.');
    expect(screen.getByLabelText('Passcode')).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('logs in, shows the tracks, and logs out from Settings (AUTH-4)', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const { router } = renderRoutes('/login', api);
    await user.type(await screen.findByLabelText('Passcode'), 'letmein');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('German Language')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    await router.navigate('/settings');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.loggedIn).toBe(false);
  });

  it('disables the button until a passcode is typed', async () => {
    renderRoutes('/login', fakeApi());
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeDisabled();
  });
});

describe('navigation (SPEC §B6)', () => {
  it('links every main screen, prefixed with /demo in demo mode', async () => {
    renderRoutes('/demo', fakeApi());
    await screen.findByText('German Language');
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    for (const path of ['/demo', '/demo/log', '/demo/history', '/demo/tasks', '/demo/more']) {
      expect(hrefs).toContain(path);
    }
  });

  it('shows a placeholder for screens from later milestones', async () => {
    renderRoutes('/tasks', fakeApi({ loggedIn: true }));
    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText(/arrive in a later update/)).toBeInTheDocument();
  });
});

describe('demo mode (DEMO-1, DEMO-2, DEMO-4)', () => {
  it('shows the banner and the seed tree without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const api = fakeApi();
    const isAuthenticated = vi.spyOn(api, 'isAuthenticated');
    renderRoutes('/demo', api);

    expect(await screen.findByText('Claude Certification')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Demo — sample data. Changes aren’t saved.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(isAuthenticated).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('offers Exit demo instead of Log out in Settings', async () => {
    renderRoutes('/demo/settings', fakeApi());
    expect(await screen.findByRole('button', { name: 'Exit demo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});
