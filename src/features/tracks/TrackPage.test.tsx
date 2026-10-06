import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

async function setup() {
  const api = fakeApi({ loggedIn: true });
  const nodes = await api.listTree();
  const exams = nodes.find((n) => n.name === 'Improvement Exams');
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
  it('lists tracks with links to their pages', async () => {
    const user = userEvent.setup();
    const { api, exams } = await setup();
    const { router } = renderRoutes('/tracks', api);
    await user.click(await screen.findByRole('link', { name: /Improvement Exams/ }));
    expect(router.state.location.pathname).toBe(`/tracks/${exams.id}`);
  });

  it('shows time, syllabus, tasks, scores, deadlines, and sessions, and sets topic status', async () => {
    const user = userEvent.setup();
    const { api, exams } = await setup();
    renderRoutes(`/tracks/${exams.id}`, api);

    expect(await screen.findByRole('heading', { name: 'Improvement Exams' })).toBeInTheDocument();
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
    // The seeded German weekly task belongs to another track.
    expect(within(tasks).queryByText(/Weekly recall/)).not.toBeInTheDocument();

    const scores = screen.getByRole('region', { name: 'Scores' });
    expect(await within(scores).findByLabelText('Kind')).toHaveValue('past_paper');
    expect(within(scores).getByRole('img', { name: /1 line/ })).toBeInTheDocument();

    const deadlines = screen.getByRole('region', { name: 'Deadlines' });
    expect(await within(deadlines).findByText('Maths exam')).toBeVisible();

    const sessions = screen.getByRole('region', { name: 'Recent sessions' });
    expect(within(sessions).getAllByRole('listitem')).toHaveLength(1);
  });
});
