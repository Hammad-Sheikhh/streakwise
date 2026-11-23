import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import type { FakeApi } from '@/test/fakeApi';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// M9b screens: UNDO-1/2/4, ERR-3/4/6, EXAM-1–5, TODAY-1–3. TEST_NOW is Sat 3 Oct 2026, 15:00.

// Toasts live in one global store; clear them so one test's Undo never shows up in the next.
afterEach(() => {
  toast.dismiss();
});

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

describe('Recent changes (UNDO-4, UNDO-5)', () => {
  it('lists changes by day with Undo, and marks them undone', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const session = await api.logSession({
      nodeId: await nodeId(api, 'Maths'),
      studiedOn: '2026-10-03',
      minutes: 45,
    });
    renderRoutes('/changes', api);

    expect(await screen.findByRole('heading', { name: 'Sat 3 Oct 2026' })).toBeInTheDocument();
    expect(screen.getByText('Logged 45m · School Subjects > Maths')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Undo: Logged 45m · School Subjects > Maths' }),
    );
    expect(await screen.findByText('Undone')).toBeInTheDocument();
    expect((await api.getHistory({})).days.flatMap((d) => d.sessions)).not.toContainEqual(
      expect.objectContaining({ id: session.id }),
    );
  });

  it('explains when there is nothing yet', async () => {
    renderRoutes('/changes', fakeApi({ loggedIn: true }));
    expect(await screen.findByText(/No changes in the last 7 days/)).toBeInTheDocument();
  });
});

describe('undo toasts (UNDO-1)', () => {
  it('undoes a task completion together with its score', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('checkbox', { name: 'Weekly self-test (this week)' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Score'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(async () => expect((await api.listTasks())[0]?.completion).toBeNull());
    expect(await api.listScores()).toEqual([]);
  });

  it('opens a session’s edit sheet on tap, deletes it there, and undoes the delete (UNDO-2)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    await api.logSession({
      nodeId: await nodeId(api, 'Maths'),
      studiedOn: '2026-10-03',
      minutes: 30,
    });
    renderRoutes('/history', api);

    await user.click(await screen.findByRole('button', { name: '30m of Maths. Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit session' });
    await user.click(within(sheet).getByRole('button', { name: 'Delete…' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(async () => expect((await api.getHistory({})).days).toEqual([]));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await api.getHistory({})).days).toHaveLength(1));
  });
});

describe('Mistakes (ERR-1, ERR-3, ERR-4, ERR-6)', () => {
  it('reviews due mistakes right and wrong, and shows counts per module', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    const right = await api.addMistake({
      nodeId: maths,
      text: 'sign error',
      createdOn: '2026-10-02',
    });
    const wrong = await api.addMistake({ nodeId: maths, text: 'units', createdOn: '2026-10-01' });
    renderRoutes('/mistakes', api);

    expect(await screen.findByRole('button', { name: 'Due today (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('2 open · 0 learned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Right: sign error' }));
    await waitFor(async () =>
      expect((await api.getMistakes()).all.find((m) => m.id === right.id)?.step).toBe(2),
    );
    await user.click(await screen.findByRole('button', { name: 'Wrong: units' }));
    await waitFor(async () => {
      const after = (await api.getMistakes()).all.find((m) => m.id === wrong.id);
      expect(after).toMatchObject({ step: 1, anchorOn: '2026-10-03', nextDueOn: '2026-10-04' });
    });
    expect(await screen.findByText(/Nothing to review today/)).toBeInTheDocument();
  });

  it('adds a mistake, and Home links to the ones due', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/mistakes', api);

    await user.click(await screen.findByRole('button', { name: 'Add mistake' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('About'), await nodeId(api, 'English'));
    await user.type(within(dialog).getByLabelText('Mistake and the right answer'), 'their/there');
    await user.click(within(dialog).getByRole('button', { name: 'Yesterday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save mistake' }));
    await waitFor(async () => expect((await api.getMistakes()).due).toHaveLength(1));

    const home = fakeApi({ loggedIn: true });
    await home.addMistake({
      nodeId: await nodeId(home, 'English'),
      text: 'a',
      createdOn: '2026-10-02',
    });
    renderRoutes('/', home);
    expect(await screen.findByRole('link', { name: '1 mistake due today' })).toHaveAttribute(
      'href',
      '/mistakes',
    );
  });
});

describe('Exam view (EXAM-1–5)', () => {
  it('shows the countdown and marks mock results below their target in words', async () => {
    const api = fakeApi({ loggedIn: true });
    const subjects = await nodeId(api, 'School Subjects');
    const exam = await api.addDeadline({
      nodeId: subjects,
      title: 'Finals',
      dueOn: '2026-10-26',
      isExam: true,
    });
    await api.addExamTarget(exam.id, { label: 'Mock 1', targetOn: '2026-10-01', minPercent: 70 });
    for (const [name, score] of [
      ['Maths', 12],
      ['English', 16],
    ] as const) {
      await api.addScore({
        nodeId: await nodeId(api, name),
        kind: 'mock_test',
        title: 'Mock 1',
        takenOn: '2026-10-01',
        score,
        maxScore: 20,
      });
    }
    renderRoutes('/exam', api);

    expect(await screen.findByText('23 days left')).toBeInTheDocument();
    const grid = await screen.findByRole('table');
    const row = within(grid).getByRole('row', { name: /Mock 1/ });
    expect(within(row).getByText('60%')).toBeInTheDocument();
    expect(within(row).getByText('▼ below 70%')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
    expect(within(grid).getAllByText('▼ below 70%')).toHaveLength(1);
  });

  it('explains how to mark an exam when there is none', async () => {
    renderRoutes('/exam', fakeApi({ loggedIn: true }));
    expect(await screen.findByText(/switch on “This is an exam”/)).toBeInTheDocument();
  });

  it('marks a deadline as an exam in Settings (EXAM-1)', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/settings/deadlines', api);

    await user.type(await screen.findByLabelText('Title'), 'Finals');
    await user.selectOptions(screen.getByLabelText('For'), await nodeId(api, 'Maths'));
    await user.click(screen.getByLabelText('This is an exam'));
    await user.click(screen.getByRole('button', { name: 'Add deadline' }));
    await waitFor(async () =>
      expect(await api.listDeadlines()).toEqual([expect.objectContaining({ isExam: true })]),
    );
  });
});

describe('the Today card (TODAY-1–3)', () => {
  it("shows today's task with working sub-task checkboxes, minutes, and pace", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    await api.updateNode(await nodeId(api, 'School Subjects'), { weeklyTargetMinutes: 600 });
    const day = await api.createTask({
      nodeId: maths,
      title: 'Day 3',
      description: 'Reading part 1',
      dueOn: '2026-10-03',
    });
    await api.createTask({ nodeId: maths, parentTaskId: day.id, title: 'Part A' });
    await api.logSession({ nodeId: maths, studiedOn: '2026-10-03', minutes: 40 });
    renderRoutes('/', api);

    const card = await screen.findByRole('region', { name: 'Today · Sat 3 Oct 2026' });
    expect(within(card).getByRole('button', { name: 'Day 3' })).toBeInTheDocument();
    expect(within(card).getByText('Reading part 1')).toBeInTheDocument();
    expect(within(card).getByText('40m')).toBeInTheDocument();
    // 600 - 40 = 560 over Saturday and Sunday.
    expect(within(card).getByText(/4h 40m needed per day/)).toBeInTheDocument();

    await user.click(within(card).getByRole('checkbox', { name: 'Part A' }));
    await waitFor(async () => {
      const part = (await api.listTasks()).find((i) => i.task.title === 'Part A');
      expect(part?.completion).not.toBeNull();
    });
  });
});
