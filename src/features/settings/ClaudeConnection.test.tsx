import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

const URL_WITH_SECRET = 'https://streakwise.example/mcp/example-secret-0123456789abcdefghijkl';

describe('Settings → Claude connection (SET-4)', () => {
  it('shows the masked URL, copies the full one, and shows the last call', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const api = fakeApi({ loggedIn: true });
    api.getClaudeConnection = async () => ({
      url: URL_WITH_SECRET,
      lastMcpCallAt: '2026-10-03T09:30:00.000Z',
    });
    renderRoutes('/settings', api);

    const section = await screen.findByRole('region', { name: 'Claude connection' });
    expect(
      await within(section).findByText('https://streakwise.example/mcp/••••••••'),
    ).toBeInTheDocument();
    expect(section).not.toHaveTextContent('example-secret');
    // 09:30 UTC is 14:30 in Karachi.
    expect(within(section).getByText(/3 Oct 2026, 14:30/)).toBeInTheDocument();
    expect(within(section).getByText(/Customize → Connectors/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Copy URL' }));
    expect(writeText).toHaveBeenCalledWith(URL_WITH_SECRET);
    expect(await within(section).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('says when the server isn’t set up and when Claude hasn’t called yet', async () => {
    const api = fakeApi({ loggedIn: true });
    api.getClaudeConnection = async () => ({ url: null, lastMcpCallAt: null });
    renderRoutes('/settings', api);
    const section = await screen.findByRole('region', { name: 'Claude connection' });
    expect(await within(section).findByText(/Not set up yet/)).toBeInTheDocument();
  });

  it('is turned off in demo mode without asking the server (DEMO-5)', async () => {
    const api = fakeApi({ loggedIn: true });
    const spy = vi.spyOn(api, 'getClaudeConnection');
    renderRoutes('/demo/settings', api);
    const section = await screen.findByRole('region', { name: 'Claude connection' });
    expect(within(section).getByText(/Not available in the demo/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
