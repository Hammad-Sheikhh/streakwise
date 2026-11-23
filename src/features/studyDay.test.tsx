import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// DAY-1, DAY-2, DAY-5, TASK-11 in the app. TEST_NOW is Saturday 3 Oct 2026, 15:00 in Karachi.

describe('"My day ends at" (DAY-1, DAY-2, DAY-5)', () => {
  it('is saved from Settings → General', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/settings', api);

    const select = await screen.findByLabelText('My day ends at');
    expect(select).toHaveDisplayValue('00:00 (midnight)');
    expect(within(select).getAllByRole('option')).toHaveLength(13);
    await user.selectOptions(select, '04:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await api.getSettings()).dayEndsAtMinutes).toBe(240));
  });

  it('dates the log form for the day before between midnight and the cutoff', async () => {
    // 01:50 on Sunday 4 Oct in Karachi.
    const api = fakeApi({ loggedIn: true, now: new Date('2026-10-03T20:50:00Z') });
    await api.updateSettings({ dayEndsAtMinutes: 240 });
    renderRoutes('/log', api);

    const date = await screen.findByLabelText('Date');
    expect(date).toHaveValue('2026-10-03');
    expect(date).toHaveAttribute('max', '2026-10-03');
    expect(screen.getByRole('button', { name: 'Today', pressed: true })).toBeInTheDocument();
    expect(
      screen.getByText('Counts for Sat 3 Oct 2026 (your day ends at 04:00).'),
    ).toBeInTheDocument();
  });

  it('shows no hint once the cutoff has passed', async () => {
    const api = fakeApi({ loggedIn: true, now: new Date('2026-10-03T23:00:00Z') }); // 04:00
    await api.updateSettings({ dayEndsAtMinutes: 240 });
    renderRoutes('/log', api);

    expect(await screen.findByLabelText('Date')).toHaveValue('2026-10-04');
    expect(screen.queryByText(/your day ends at/)).not.toBeInTheDocument();
  });
});

describe('"Done on" (TASK-11)', () => {
  it('records a scored completion for yesterday', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('checkbox', { name: 'Weekly self-test (this week)' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Score'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Yesterday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));

    await waitFor(async () => {
      const [item] = await api.listTasks();
      expect(item?.completion?.completedOn).toBe('2026-10-02');
    });
    expect((await api.listScores())[0]?.takenOn).toBe('2026-10-02');
  });

  it('refuses a future day in the score dialog', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('checkbox', { name: 'Weekly self-test (this week)' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Score'), '15');
    const date = within(dialog).getByLabelText('Done on');
    await user.clear(date);
    await user.type(date, '2026-10-05');
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));
    expect(within(dialog).getByText('Choose today or an earlier day.')).toBeInTheDocument();
    expect((await api.listTasks())[0]?.completion).toBeNull();
  });

  it('ticks an unscored task for an earlier day from its details', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = (await api.listTree()).find((n) => n.name === 'Maths');
    await api.createTask({ nodeId: maths?.id ?? null, title: 'Read chapter 2' });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('button', { name: /^Read chapter 2/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Done on another day…' }));
    const form = within(dialog).getByRole('form', { name: 'Done on another day' });
    expect(within(form).getByLabelText('Done on')).toHaveValue('2026-10-02');
    await user.click(within(form).getByRole('button', { name: 'Mark done' }));

    await waitFor(async () => {
      const item = (await api.listTasks()).find((i) => i.task.title === 'Read chapter 2');
      expect(item?.completion?.completedOn).toBe('2026-10-02');
    });
  });
});
