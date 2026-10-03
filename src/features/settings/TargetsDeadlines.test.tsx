import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

describe('Weekly targets (TGT-1)', () => {
  it('saves a target in half-hour steps and clears it', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/settings/targets', api);

    const select = await screen.findByLabelText('German Language');
    await user.selectOptions(select, '1.5h a week');
    await waitFor(async () => expect((await api.listTree())[0]?.weeklyTargetMinutes).toBe(90));
    await user.selectOptions(select, 'No target');
    await waitFor(async () => expect((await api.listTree())[0]?.weeklyTargetMinutes).toBeNull());
  });
});

describe('Deadlines (DEAD-1)', () => {
  it('adds, edits, and deletes a deadline', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/settings/deadlines', api);

    const form = await screen.findByRole('region', { name: 'Add a deadline' });
    await user.click(within(form).getByRole('button', { name: 'Add deadline' }));
    expect(within(form).getByText('Enter a title.')).toBeInTheDocument();
    expect(within(form).getByText('Choose what it’s for.')).toBeInTheDocument();

    await user.type(within(form).getByLabelText('Title'), 'Maths exam');
    await user.clear(within(form).getByLabelText('Date'));
    await user.type(within(form).getByLabelText('Date'), '2026-11-13');
    const forSelect = within(form).getByLabelText('For');
    await user.selectOptions(forSelect, within(forSelect).getByRole('option', { name: /Maths/ }));
    await user.click(within(form).getByRole('button', { name: 'Add deadline' }));

    const upcoming = await screen.findByRole('region', { name: 'Upcoming' });
    expect(await within(upcoming).findByText('Maths exam')).toBeInTheDocument();
    expect(within(upcoming).getByText('Fri 13 Nov 2026 · in 41 days')).toBeInTheDocument();
    expect(within(form).getByLabelText('Title')).toHaveValue('');

    await user.click(within(upcoming).getByRole('button', { name: 'Edit Maths exam' }));
    const dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Final exam');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(upcoming).findByText('Final exam')).toBeInTheDocument();

    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    await user.click(within(upcoming).getByRole('button', { name: 'Delete Final exam' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(async () => expect(await api.listDeadlines()).toHaveLength(0));
  });
});
