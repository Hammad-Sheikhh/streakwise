import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { FakeApi } from '@/test/fakeApi';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

async function withSessions() {
  const api = fakeApi({ loggedIn: true });
  const maths = await nodeId(api, 'Maths');
  const classId = await nodeId(api, 'Practice');
  await api.logSession({ nodeId: maths, studiedOn: '2026-10-01', minutes: 30 });
  await api.logSession({ nodeId: classId, studiedOn: '2026-10-03', minutes: 45, note: 'Verbs' });
  await api.logSession({ nodeId: maths, studiedOn: '2026-10-03', minutes: 60 });
  return { api, maths, classId };
}

describe('History (HIST-1)', () => {
  it('groups sessions by day, newest first, with daily totals', async () => {
    const { api } = await withSessions();
    renderRoutes('/history', api);

    const today = await screen.findByRole('region', { name: 'Today' });
    expect(today).toHaveTextContent('1h 45m');
    expect(within(today).getAllByRole('listitem')).toHaveLength(2);
    expect(within(today).getByText('Verbs')).toBeInTheDocument();

    const days = screen
      .getAllByRole('region')
      .map((r) => r.getAttribute('aria-labelledby'))
      .filter((id) => id?.startsWith('day-'));
    expect(days).toEqual(['day-2026-10-03', 'day-2026-10-01']);
  });

  it('shows an empty state with a way to log', async () => {
    renderRoutes('/history', fakeApi({ loggedIn: true }));
    const message = await screen.findByText(/No sessions yet/);
    const emptyState = message.parentElement ?? document.body;
    expect(within(emptyState).getByRole('link', { name: 'Log a session' })).toHaveAttribute(
      'href',
      '/log',
    );
  });
});

describe('editing and deleting (HIST-2)', () => {
  it('edits a session in a dialog', async () => {
    const { api } = await withSessions();
    const user = userEvent.setup();
    renderRoutes('/history', api);

    await user.click(await screen.findByRole('button', { name: 'Edit 45m of Practice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit session' });
    await user.click(within(dialog).getByRole('button', { name: '2h' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('button', { name: 'Edit 2h of Practice' })).toBeInTheDocument();
    const [day] = (await api.getHistory({})).days;
    expect(day?.totalMinutes).toBe(180);
  });

  it('deletes only after confirmation', async () => {
    const { api } = await withSessions();
    const user = userEvent.setup();
    renderRoutes('/history', api);

    await user.click(await screen.findByRole('button', { name: 'Delete 30m of Maths' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete 30m of Maths' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 30m of Maths' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Delete 30m of Maths' })).not.toBeInTheDocument(),
    );
  });
});

describe('filters and badges (HIST-3, HIST-4)', () => {
  it('filters by node from the URL, including descendants', async () => {
    const { api } = await withSessions();
    const exams = await nodeId(api, 'School Subjects');
    renderRoutes(`/history?node=${exams}`, api);

    await screen.findByRole('region', { name: 'Today' });
    expect(screen.queryByText('Verbs')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Edit .* of Maths$/ })).toHaveLength(2);
    expect(screen.getByLabelText('Subject')).toHaveDisplayValue(/School Subjects/);
  });

  it('marks sessions logged by Claude', async () => {
    const { api, maths } = await withSessions();
    vi.spyOn(api, 'getHistory').mockResolvedValue({
      days: [
        {
          date: '2026-10-03',
          totalMinutes: 25,
          sessions: [
            {
              id: '00000000-0000-4000-8000-0000000000aa',
              nodeId: maths,
              studiedOn: '2026-10-03',
              minutes: 25,
              note: null,
              source: 'claude',
              createdAt: '2026-10-03T09:00:00.000Z',
              updatedAt: '2026-10-03T09:00:00.000Z',
            },
          ],
        },
      ],
      nextTo: null,
    });
    renderRoutes('/history', api);
    expect(await screen.findByText('via Claude')).toBeInTheDocument();
  });
});
