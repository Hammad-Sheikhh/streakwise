import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// Saturday 2026-10-03 (TEST_NOW): this week is Mon 28 Sep – Sun 4 Oct.

afterEach(() => vi.restoreAllMocks());

describe('Reports (REP-1–8)', () => {
  it('shows this week’s report and switches periods', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    await api.updateSettings({ studentName: 'Demo Student' });
    renderRoutes('/reports', api);

    expect(await screen.findByRole('heading', { name: 'Weekly study report' })).toBeInTheDocument();
    expect(screen.getByText('Demo Student · This week: 28 Sep – 4 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Yesterday' }));
    expect(await screen.findByRole('heading', { name: 'Daily study report' })).toBeInTheDocument();
    expect(screen.getByText(/Yesterday: Fri 2 Oct 2026/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Study report' })).toBeInTheDocument();
  });

  it('includes notes only when the toggle is on (REP-5)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const node = (await api.listTree()).find((n) => n.name === 'Self-study');
    if (!node) throw new Error('seed missing');
    await api.logSession({ nodeId: node.id, studiedOn: '2026-10-02', minutes: 30, note: 'Dative' });
    renderRoutes('/reports', api);

    await screen.findByRole('heading', { name: 'Weekly study report' });
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', { name: 'Include notes' });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(await screen.findByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText(/: Dative$/)).toBeInTheDocument();
  });

  it('copies as text and for Claude, and prints', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderRoutes('/reports', fakeApi({ loggedIn: true }));
    await screen.findByRole('heading', { name: 'Weekly study report' });

    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/^\*Weekly study report\*/));
    await user.click(screen.getByRole('button', { name: 'Copy for Claude' }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/^# Study report: This week/));
    await user.click(screen.getByRole('button', { name: 'Print / Save as PDF' }));
    expect(print).toHaveBeenCalled();
  });

  it('asks for the student name when it is empty', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/reports', api);

    const name = await screen.findByLabelText('What name should your reports show?');
    await user.type(name, 'Demo Student');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/^Demo Student · This week/)).toBeInTheDocument();
    expect(screen.queryByLabelText('What name should your reports show?')).not.toBeInTheDocument();
  });

  it('creates a share link with a chosen expiry (SHARE-1, SHARE-6)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const create = vi.spyOn(api, 'createShare');
    renderRoutes('/reports', api);
    await screen.findByRole('heading', { name: 'Weekly study report' });

    await user.click(screen.getByRole('button', { name: 'Share link' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Link expires'), 'After 7 days');
    await user.click(within(dialog).getByRole('button', { name: 'Create link' }));

    const url = await within(dialog).findByLabelText<HTMLInputElement>('Link');
    expect(url.value).toMatch(/\/r\/[A-Za-z0-9_-]{32}$/);
    expect(create).toHaveBeenCalledWith({
      report: { period: 'this_week', includeNotes: false },
      expiresInDays: 7,
    });
  });

  it('turns share links off in the demo (DEMO-5) but keeps print and copy', async () => {
    renderRoutes('/demo/reports', fakeApi());
    await screen.findByRole('heading', { name: 'Weekly study report' });
    expect(screen.getByRole('button', { name: 'Share link' })).toBeDisabled();
    expect(screen.getByText(/Share links are off in the demo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeEnabled();
  });
});
