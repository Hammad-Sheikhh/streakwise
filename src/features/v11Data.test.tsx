import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FakeApi } from '@/test/fakeApi';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// M9c in the app: TIMER-1–3, DATA-1–3. TEST_NOW is Sat 3 Oct 2026, 15:00 in Karachi.

afterEach(() => {
  toast.dismiss();
  localStorage.clear();
});

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

describe('the timer (TIMER-1–3)', () => {
  it('starts from the Log screen, shows a pill, and stop fills in the Log form', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderRoutes('/log', api);

    const start = await screen.findByRole('button', { name: 'Start timer' });
    expect(start).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Track'), 'School Subjects');
    await user.selectOptions(screen.getByLabelText('Subtask (optional)'), 'Maths');
    await user.click(start);

    const pill = await screen.findByRole('region', { name: 'Timer' });
    expect(within(pill).getByText('School Subjects › Maths')).toBeInTheDocument();
    expect(localStorage.getItem('streakwise.timer.api')).toContain(await nodeId(api, 'Maths'));
    // A second timer isn't started while one runs.
    await user.click(screen.getByRole('link', { name: 'Log' }));
    await user.selectOptions(await screen.findByLabelText('Track'), 'Exam Prep');
    await user.click(screen.getByRole('button', { name: 'Start timer' }));
    expect(await screen.findByText(/A timer is already running on Maths/)).toBeInTheDocument();

    await user.click(within(pill).getByRole('button', { name: 'Stop' }));
    expect(await screen.findByLabelText('Date')).toHaveValue('2026-10-03');
    expect(screen.getByLabelText('Note (optional)')).toHaveFocus();
    expect(screen.getByLabelText('Subtask (optional)')).toHaveDisplayValue('Maths');
    expect(screen.queryByRole('region', { name: 'Timer' })).not.toBeInTheDocument();
    expect(localStorage.getItem('streakwise.timer.api')).toBeNull();
    // TIMER-3: running and stopping never called the server.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('can be discarded, and survives a reload of the page', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    localStorage.setItem(
      'streakwise.timer.api',
      JSON.stringify({
        nodeId: await nodeId(api, 'English'),
        startedAt: '2026-10-03T09:00:00.000Z',
      }),
    );
    renderRoutes('/', api);

    const pill = await screen.findByRole('region', { name: 'Timer' });
    expect(within(pill).getByText('1:00:00')).toBeInTheDocument();
    await user.click(within(pill).getByRole('button', { name: 'Discard the timer' }));
    await user.click(within(pill).getByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Timer' })).not.toBeInTheDocument(),
    );
    expect((await api.getHistory({})).days).toEqual([]);
  });
});

describe('searching notes (DATA-1)', () => {
  it('finds sessions by their note and marks the match', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    await api.logSession({
      nodeId: maths,
      studiedOn: '2026-10-02',
      minutes: 30,
      note: 'Day 3: Lesen',
    });
    await api.logSession({ nodeId: maths, studiedOn: '2026-10-03', minutes: 20, note: 'Review' });
    renderRoutes('/history', api);

    await user.type(await screen.findByLabelText('Search notes'), 'day 3');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(screen.queryByText('Review')).not.toBeInTheDocument());
    const mark = screen.getByText('Day 3', { selector: 'mark' });
    expect(mark).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search notes'));
    expect(await screen.findByText('Review')).toBeInTheDocument();
  });
});

describe('restore from a backup (DATA-3)', () => {
  it('summarises the file, asks for RESTORE, downloads a safety copy, then restores', async () => {
    const user = userEvent.setup();
    const createUrl = vi.fn(() => 'blob:test');
    URL.createObjectURL = createUrl as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const source = fakeApi({ loggedIn: true });
    await source.logSession({
      nodeId: await nodeId(source, 'English'),
      studiedOn: '2026-09-30',
      minutes: 50,
    });
    const backup = JSON.stringify(await source.exportData());

    const api = fakeApi({ loggedIn: true });
    await api.logSession({
      nodeId: await nodeId(api, 'Maths'),
      studiedOn: '2026-10-03',
      minutes: 5,
    });
    renderRoutes('/settings', api);

    const file = new File([backup], 'streakwise-2026-10-03.json', { type: 'application/json' });
    await user.upload(await screen.findByLabelText('Backup file (.json)'), file);
    expect(await screen.findByText(/1 sessions \(Wed 30 Sep 2026\)/)).toBeInTheDocument();
    const restore = screen.getByRole('button', { name: 'Restore this backup' });
    expect(restore).toBeDisabled();
    await user.type(screen.getByLabelText('Type RESTORE to confirm'), 'restore');
    expect(restore).toBeDisabled();
    await user.clear(screen.getByLabelText('Type RESTORE to confirm'));
    await user.type(screen.getByLabelText('Type RESTORE to confirm'), 'RESTORE');
    await user.click(restore);

    await waitFor(async () => {
      const sessions = (await api.getHistory({ from: '2026-09-01' })).days.flatMap(
        (d) => d.sessions,
      );
      expect(sessions.map((s) => s.minutes)).toEqual([50]);
    });
    // The safety copy of the data from before was downloaded first.
    expect(createUrl).toHaveBeenCalledTimes(1);
  });

  it('explains when a file is not a backup', async () => {
    const user = userEvent.setup();
    renderRoutes('/settings', fakeApi({ loggedIn: true }));
    const file = new File(['{"hello": 1}'], 'notes.json', { type: 'application/json' });
    await user.upload(await screen.findByLabelText('Backup file (.json)'), file);
    expect(await screen.findByText(/isn’t a Streakwise backup file/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore this backup' })).not.toBeInTheDocument();
  });

  it('offers scores, tasks, and mistakes as CSV (DATA-2)', async () => {
    renderRoutes('/settings', fakeApi({ loggedIn: true }));
    for (const name of ['Scores (CSV)', 'Tasks (CSV)', 'Mistakes (CSV)']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
  });
});
