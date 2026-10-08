import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { FakeApi } from '@/test/fakeApi';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// TEST_NOW is Saturday 2026-10-03, 15:00 in Karachi. The seed is created at TEST_NOW, so nothing
// is neglected until sessions or older nodes say otherwise.

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

async function home(api: FakeApi) {
  const result = renderRoutes('/', api);
  await screen.findByRole('heading', { name: 'This week' });
  return result;
}

describe('Home dashboard (DASH-1)', () => {
  it('shows today, the streak, and weekly targets with progress (STRK-1/2, TGT-2)', async () => {
    const api = fakeApi({ loggedIn: true });
    const examPrep = await nodeId(api, 'Exam Prep');
    await api.updateNode(examPrep, { weeklyTargetMinutes: 480 });
    await api.logSession({ nodeId: examPrep, studiedOn: '2026-10-03', minutes: 120 });
    await api.logSession({ nodeId: examPrep, studiedOn: '2026-10-02', minutes: 80 });
    await home(api);

    expect(screen.getByRole('region', { name: 'Today' })).toHaveTextContent('2h');
    expect(screen.getByRole('region', { name: 'Streak' })).toHaveTextContent('2 days');
    expect(screen.getByRole('region', { name: 'Streak' })).toHaveTextContent('Longest: 2');
    const bar = screen.getByRole('progressbar', { name: 'Exam Prep weekly target' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('3h 20m / 8h · 42%')).toBeInTheDocument();
    // Tracks without a target show their time only.
    expect(screen.getAllByText('0m this week')).toHaveLength(2);
  });

  it('warns about neglected subjects and links to Log with them preselected (NEG-1)', async () => {
    const api = fakeApi({ loggedIn: true });
    const user = userEvent.setup();
    const maths = await nodeId(api, 'Maths');
    await api.logSession({ nodeId: maths, studiedOn: '2026-09-28', minutes: 30 });
    const { router } = await home(api);

    const warnings = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(warnings).getByText('School Subjects — 5 days untouched')).toBeInTheDocument();
    await user.click(within(warnings).getByRole('link', { name: /Maths — 5 days untouched/ }));
    await waitFor(() => expect(router.state.location.search).toBe(`?node=${maths}`));
  });

  it('counts down to the next deadlines with syllabus left (DEAD-2/3)', async () => {
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    const algebra = await api.addNode({ parentId: maths, name: 'Algebra' });
    await api.addNode({ parentId: maths, name: 'Geometry' });
    await api.addNode({ parentId: algebra.id, name: 'x' }).catch(() => undefined); // max depth
    await api.addDeadline({ nodeId: maths, title: 'Maths exam', dueOn: '2026-11-13' });
    await api.addDeadline({ nodeId: maths, title: 'Old quiz', dueOn: '2026-09-01' });
    await home(api);

    const upcoming = screen.getByRole('region', { name: 'Coming up' });
    expect(within(upcoming).getByText('Maths exam')).toBeInTheDocument();
    expect(within(upcoming).getByText('in 41 days')).toBeInTheDocument();
    expect(within(upcoming).getByText('100% of syllabus left')).toBeInTheDocument();
    expect(within(upcoming).queryByText('Old quiz')).not.toBeInTheDocument();
  });
});

describe('heatmap (HEAT-1–3)', () => {
  it('labels every day and opens a day’s sessions', async () => {
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    await api.logSession({ nodeId: maths, studiedOn: '2026-10-01', minutes: 90 });
    await home(api);

    const cell = document.querySelector<HTMLButtonElement>('[data-date="2026-10-01"]');
    expect(cell).toHaveAttribute('aria-label', 'Thu 1 Oct 2026: 1h 30m');
    expect(cell?.className).toContain('bg-emerald-400');
    expect(document.querySelectorAll('[data-date]').length).toBeGreaterThan(360);

    // Only today's cell is in the tab order; it starts selected.
    const today = document.querySelector('[data-date="2026-10-03"]');
    expect(today).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Sat 3 Oct 2026: no study')).toBeInTheDocument();

    if (cell) fireEvent.click(cell);
    expect(await screen.findByText('Thu 1 Oct 2026: 1h 30m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See sessions' })).toHaveAttribute(
      'href',
      '/history?from=2026-10-01&to=2026-10-01',
    );
  });

  it('moves between days with the arrow keys', async () => {
    await home(fakeApi({ loggedIn: true }));
    const today = document.querySelector<HTMLButtonElement>('[data-date="2026-10-03"]');
    today?.focus();
    if (today) fireEvent.keyDown(today, { key: 'ArrowLeft' });
    expect(document.activeElement).toHaveAttribute('data-date', '2026-09-26');
    if (document.activeElement) fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(document.activeElement).toHaveAttribute('data-date', '2026-09-25');
    // Never past today.
    if (document.activeElement) fireEvent.keyDown(document.activeElement, { key: 'End' });
    if (document.activeElement) fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-date', '2026-10-03');
  });
});
