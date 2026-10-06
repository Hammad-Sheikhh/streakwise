import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ScoreKind } from '@/core/domain/types';
import { fakeApi } from '@/test/fakeApi';
import type { FakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

async function seedScores(api: FakeApi) {
  const maths = await nodeId(api, 'Maths');
  const german = await nodeId(api, 'Self-study');
  const add = (id: string, kind: ScoreKind, takenOn: string, score: number) =>
    api.addScore({ nodeId: id, kind, title: `${kind} ${takenOn}`, takenOn, score, maxScore: 50 });
  await add(maths, 'past_paper', '2026-09-01', 25);
  await add(maths, 'past_paper', '2026-09-10', 30);
  await add(maths, 'quiz', '2026-09-12', 40);
  await add(german, 'revision', '2026-09-15', 45);
}

describe('Scores screen (SCORE-1–5)', () => {
  it('shows an empty state, then adds a score with validation', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/scores', api);

    expect(await screen.findByText(/No scores yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add score' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), '2023 Paper 1');
    await user.type(within(dialog).getByLabelText('Score'), '62');
    await user.type(within(dialog).getByLabelText('Out of'), '60');
    const forSelect = within(dialog).getByLabelText('For');
    await user.selectOptions(forSelect, within(forSelect).getByRole('option', { name: /Maths/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save score' }));
    expect(
      within(dialog).getByText('The score can’t be more than the maximum.'),
    ).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Out of'));
    await user.type(within(dialog).getByLabelText('Out of'), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Save score' }));

    const results = await screen.findByRole('region', { name: 'Results' });
    expect(await within(results).findByText('2023 Paper 1')).toBeInTheDocument();
    expect(within(results).getByText('77.5%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Score percentages over time, 1 line/ })).toBeVisible();
  });

  it('charts a line per subtask with trends and opens a track on its usual kind', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    await seedScores(api);
    renderRoutes('/scores', api);

    const legend = await screen.findByRole('list', { name: 'Legend' });
    expect(within(legend).getByText('Maths')).toBeInTheDocument();
    expect(within(legend).getByText('Self-study')).toBeInTheDocument();
    // Maths: 50% then (60%, 80%) → up 20 points.
    expect(within(legend).getByText('Trend: up 20 percentage points')).toBeInTheDocument();

    // SCORE-5: Improvement Exams records past papers most, so it opens on them.
    await user.selectOptions(screen.getByLabelText('Track'), 'Improvement Exams');
    expect(screen.getByLabelText('Kind')).toHaveValue('past_paper');
    const results = screen.getByRole('region', { name: 'Results' });
    expect(within(results).getAllByRole('row')).toHaveLength(3); // header + 2 past papers
    expect(screen.getByRole('img', { name: /1 line/ })).toBeInTheDocument();
  });

  it('edits and deletes a score, newest first', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    await seedScores(api);
    renderRoutes('/scores', api);

    const results = await screen.findByRole('region', { name: 'Results' });
    const rows = await within(results).findAllByRole('row');
    expect(within(rows[1] as HTMLElement).getByText('revision 2026-09-15')).toBeInTheDocument();

    await user.click(within(results).getByRole('button', { name: 'Edit quiz 2026-09-12' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Score'));
    await user.type(within(dialog).getByLabelText('Score'), '35');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(results).findByText('70%')).toBeInTheDocument();

    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    await user.click(within(results).getByRole('button', { name: 'Delete quiz 2026-09-12' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(async () => expect(await api.listScores()).toHaveLength(3));
  });
});
