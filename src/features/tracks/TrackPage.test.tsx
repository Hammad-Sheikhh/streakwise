import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

async function setup() {
  const api = fakeApi({ loggedIn: true });
  const nodes = await api.listTree();
  const exams = nodes.find((n) => n.name === 'School Subjects');
  const maths = nodes.find((n) => n.name === 'Maths');
  if (!exams || !maths) throw new Error('seed is missing nodes');
  const ch1 = await api.addNode({ parentId: maths.id, name: 'Chapter 1' });
  await api.addNode({ parentId: maths.id, name: 'Chapter 2' });
  await api.logSession({ nodeId: ch1.id, studiedOn: '2026-10-02', minutes: 90 });
  await api.createTask({ nodeId: maths.id, title: 'Past paper 2023' });
  await api.addScore({
    nodeId: maths.id,
    kind: 'past_paper',
    title: 'Paper A',
    takenOn: '2026-10-01',
    score: 30,
    maxScore: 40,
  });
  await api.addDeadline({ nodeId: maths.id, title: 'Maths exam', dueOn: '2026-11-13' });
  return { api, exams };
}

describe('Track page (TRACK-1, TOP-1, TOP-2)', () => {
  it('adds a new track from the Tracks screen', async () => {
    const user = userEvent.setup();
    renderRoutes('/tracks', fakeApi({ loggedIn: true }));
    await user.type(await screen.findByLabelText('New track'), 'Piano');
    await user.click(screen.getByRole('button', { name: 'Add track' }));
    expect(await screen.findByRole('link', { name: /Piano/ })).toBeInTheDocument();
  });

  it('lists tracks with links to their pages', async () => {
    const user = userEvent.setup();
    const { api, exams } = await setup();
    const { router } = renderRoutes('/tracks', api);
    await user.click(await screen.findByRole('link', { name: /School Subjects/ }));
    expect(router.state.location.pathname).toBe(`/tracks/${exams.id}`);
  });

  it('shows time, syllabus, tasks, scores, deadlines, and sessions, and sets topic status', async () => {
    const user = userEvent.setup();
    const { api, exams } = await setup();
    renderRoutes(`/tracks/${exams.id}`, api);

    expect(await screen.findByRole('heading', { name: 'School Subjects' })).toBeInTheDocument();
    const subtasks = screen.getByRole('region', { name: 'Subtasks and topics' });
    // Chapter 1 was logged, so it is in progress; nothing is done yet.
    expect(within(subtasks).getByText('1h 30m this week · 1h 30m total · 0% done')).toBeVisible();
    expect(within(subtasks).getByLabelText('Chapter 1 status')).toHaveValue('in_progress');

    await user.selectOptions(within(subtasks).getByLabelText('Chapter 1 status'), 'Done');
    expect(
      await within(subtasks).findByText('1h 30m this week · 1h 30m total · 50% done'),
    ).toBeVisible();

    // A done topic can be reopened.
    await user.selectOptions(within(subtasks).getByLabelText('Chapter 1 status'), 'In progress');
    await waitFor(async () =>
      expect((await api.listTree()).find((n) => n.name === 'Chapter 1')?.topicStatus).toBe(
        'in_progress',
      ),
    );

    const tasks = screen.getByRole('region', { name: 'Tasks' });
    expect(await within(tasks).findByRole('checkbox', { name: 'Past paper 2023' })).toBeVisible();
    // The seeded Exam Prep weekly task belongs to another track.
    expect(within(tasks).queryByText(/Weekly self-test/)).not.toBeInTheDocument();

    const scores = screen.getByRole('region', { name: 'Scores' });
    expect(await within(scores).findByLabelText('Kind')).toHaveValue('past_paper');
    expect(within(scores).getByRole('img', { name: /1 line/ })).toBeInTheDocument();

    const deadlines = screen.getByRole('region', { name: 'Deadlines' });
    expect(await within(deadlines).findByText('Maths exam')).toBeVisible();

    const sessions = screen.getByRole('region', { name: 'Recent sessions' });
    expect(within(sessions).getAllByRole('listitem')).toHaveLength(1);
  });

  it('hides deadlines on archived parts of the track (TREE-2)', async () => {
    const api = fakeApi({ loggedIn: true });
    const nodes = await api.listTree();
    const exams = nodes.find((n) => n.name === 'School Subjects');
    const maths = nodes.find((n) => n.name === 'Maths');
    if (!exams || !maths) throw new Error('seed is missing nodes');
    const chapter = await api.addNode({ parentId: maths.id, name: 'Chapter 1' });
    await api.addDeadline({ nodeId: maths.id, title: 'Maths exam', dueOn: '2026-11-13' });
    await api.addDeadline({ nodeId: chapter.id, title: 'Hidden quiz', dueOn: '2026-11-01' });
    await api.updateNode(chapter.id, { archived: true });
    renderRoutes(`/tracks/${exams.id}`, api);

    const deadlines = await screen.findByRole('region', { name: 'Deadlines' });
    expect(await within(deadlines).findByText('Maths exam')).toBeVisible();
    expect(within(deadlines).queryByText('Hidden quiz')).not.toBeInTheDocument();
  });

  it('deletes a track with no history from the track page (TREE-3)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const nodes = await api.listTree();
    const course = nodes.find((n) => n.name === 'Online Course');
    if (!course) throw new Error('seed is missing nodes');
    const { router } = renderRoutes(`/tracks/${course.id}`, api);

    await user.click(await screen.findByRole('button', { name: 'Manage track' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Online Course');

    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/tracks'));
    expect((await api.listTree()).some((n) => n.name === 'Online Course')).toBe(false);
  });

  it('offers Archive instead of delete when the track has history (TREE-3)', async () => {
    const user = userEvent.setup();
    const { api, exams } = await setup();
    renderRoutes(`/tracks/${exams.id}`, api);

    await user.click(await screen.findByRole('button', { name: 'Manage track' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'or something inside it has history, so it can’t be deleted.',
    );
  });
});
