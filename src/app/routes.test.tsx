import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

describe('navigation (SPEC §B6)', () => {
  it('links every main screen, prefixed with /demo in demo mode', async () => {
    renderRoutes('/demo', fakeApi());
    await screen.findByRole('heading', { name: 'This week' });
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    for (const path of ['/demo', '/demo/log', '/demo/history', '/demo/tasks', '/demo/more']) {
      expect(hrefs).toContain(path);
    }
  });

  it('lazy-loads the Reports screen', async () => {
    renderRoutes('/reports', fakeApi({ loggedIn: true }));
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
  });
});

describe('demo mode (DEMO-1, DEMO-2, DEMO-4)', () => {
  it('shows the banner and the seed tree without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const api = fakeApi();
    const isAuthenticated = vi.spyOn(api, 'isAuthenticated');
    renderRoutes('/demo', api);

    expect(await screen.findByText('Online Course')).toBeInTheDocument();
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
