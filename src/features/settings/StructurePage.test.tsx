import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

async function openStructure() {
  const user = userEvent.setup();
  const api = fakeApi({ loggedIn: true });
  renderRoutes('/settings/structure', api);
  await screen.findByText('Exam Prep');
  const trackNames = async () =>
    (await api.listTree()).filter((n) => n.depth === 1).map((n) => n.name);
  return { user, api, trackNames };
}

describe('Structure (TREE-1, TREE-6)', () => {
  it('adds a track and a subtask under it', async () => {
    const { user, api } = await openStructure();
    await user.type(screen.getByLabelText('New track'), 'Piano');
    await user.click(screen.getByRole('button', { name: 'Add track' }));
    await user.click(await screen.findByRole('button', { name: 'Manage Piano' }));

    const dialog = await screen.findByRole('dialog', { name: 'Piano' });
    await user.type(within(dialog).getByLabelText('Add a subtask'), 'Scales');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(async () =>
      expect((await api.listTree()).find((n) => n.name === 'Scales')).toMatchObject({ depth: 2 }),
    );
  });

  it('renames a node and shows clashes as an error', async () => {
    const { user, api } = await openStructure();
    await user.click(screen.getByRole('button', { name: 'Manage Flashcards' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Name');

    await user.clear(name);
    await user.type(name, 'Practice');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(await screen.findByText('Something with that name already exists here.')).toBeVisible();

    await user.clear(name);
    await user.type(name, 'Homework');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    await waitFor(async () =>
      expect((await api.listTree()).some((n) => n.name === 'Homework')).toBe(true),
    );
  });

  it('moves tracks with the up and down buttons', async () => {
    const { user, trackNames } = await openStructure();
    expect(screen.getByRole('button', { name: 'Move Exam Prep up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Online Course up' }));
    await waitFor(async () =>
      expect(await trackNames()).toEqual(['Exam Prep', 'Online Course', 'School Subjects']),
    );
  });

  it('offers no way to add below a topic (max depth)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = (await api.listTree()).find((n) => n.name === 'Maths');
    await api.addNode({ parentId: maths?.id ?? null, name: 'Algebra' });
    renderRoutes('/settings/structure', api);
    await user.click(await screen.findByRole('button', { name: 'Manage Algebra' }));
    const dialog = await screen.findByRole('dialog', { name: 'Algebra' });
    expect(within(dialog).queryByLabelText(/^Add a/)).not.toBeInTheDocument();
  });
});

describe('archive, restore, and delete (TREE-2, TREE-3, TREE-5)', () => {
  it('archives a node, hides it, and restores it from "Show archived"', async () => {
    const { user } = await openStructure();
    await user.click(screen.getByRole('button', { name: 'Manage School Subjects' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }),
    );
    await waitFor(() => expect(screen.queryByText('School Subjects')).not.toBeInTheDocument());
    expect(screen.queryByText('Maths')).not.toBeInTheDocument();
    // The closing dialog releases the page once its cleanup has run.
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));

    await user.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByText('Maths')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage School Subjects' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }),
    );
    expect(
      await within(screen.getByRole('dialog')).findByRole('button', { name: 'Archive' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));

    await user.click(screen.getByLabelText('Show archived'));
    expect(screen.getByText('School Subjects')).toBeInTheDocument();
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  });

  it('deletes an unused node after confirmation', async () => {
    const { user, api } = await openStructure();
    await user.click(screen.getByRole('button', { name: 'Manage English' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete…' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(async () =>
      expect((await api.listTree()).some((n) => n.name === 'English')).toBe(false),
    );
  });

  it('suggests archiving when the node has history', async () => {
    const { user } = await openStructure();
    // The seed's weekly task is attached to Exam Prep.
    await user.click(screen.getByRole('button', { name: 'Manage Exam Prep' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete…' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'can’t be deleted. Archive it instead.',
    );
  });
});
