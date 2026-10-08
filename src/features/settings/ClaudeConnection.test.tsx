import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

const NEW_URL = 'https://streakwise.example/mcp/new-token-0123456789abcdefghijklmnopqrstuv';

describe('Settings → Claude connection (SET-4, ACCT-8)', () => {
  it('creates a link, shows it masked once, and copies the full URL', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const api = fakeApi({ loggedIn: true });
    api.getClaudeConnection = async () => ({ url: null, hasLink: false, lastMcpCallAt: null });
    renderRoutes('/settings', api);

    const section = await screen.findByRole('region', { name: 'Claude connection' });
    await user.click(await within(section).findByRole('button', { name: 'Create Claude link' }));

    expect(
      await within(section).findByText('https://streakwise.example/mcp/••••••••'),
    ).toBeInTheDocument();
    expect(section).not.toHaveTextContent('new-token');
    expect(within(section).getByText(/shown only this once/)).toBeInTheDocument();
    expect(within(section).getByText(/Customize → Connectors/)).toBeInTheDocument();
    expect(section).toHaveTextContent('Last used by Claude: never');

    await user.click(within(section).getByRole('button', { name: 'Copy URL' }));
    expect(writeText).toHaveBeenCalledWith(NEW_URL);
    expect(await within(section).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('asks before replacing an existing link, and shows the last call', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const api = fakeApi({ loggedIn: true });
    api.getClaudeConnection = async () => ({
      url: null,
      hasLink: true,
      lastMcpCallAt: '2026-10-03T09:30:00.000Z',
    });
    const create = vi.spyOn(api.account, 'createClaudeLink');
    renderRoutes('/settings', api);

    const section = await screen.findByRole('region', { name: 'Claude connection' });
    // 09:30 UTC is 14:30 in Karachi.
    expect(await within(section).findByText(/3 Oct 2026, 14:30/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Make a new link' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    confirm.mockRestore();
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
