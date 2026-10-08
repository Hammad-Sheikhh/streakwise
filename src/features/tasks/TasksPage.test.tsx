import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// The seed has one task: "Weekly self-test" on Exam Prep, weekly, scored out of 20.
const WEEKLY = 'Weekly self-test (this week)';

describe('Tasks screen (TASK-1–9)', () => {
  it('groups tasks by track and completes a scored weekly task with a score', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    expect(await screen.findByRole('heading', { name: 'Exam Prep' })).toBeInTheDocument();
    const checkbox = await screen.findByRole('checkbox', { name: WEEKLY });
    await user.click(checkbox);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Out of')).toHaveValue('20');
    expect(within(dialog).getByLabelText('Kind')).toHaveValue('revision');
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));
    expect(within(dialog).getByText('Enter a score of 0 or more.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Score'), '25');
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));
    expect(
      within(dialog).getByText('The score can’t be more than the maximum.'),
    ).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Score'));
    await user.type(within(dialog).getByLabelText('Score'), '17');
    await user.click(within(dialog).getByRole('button', { name: 'Save and complete' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: WEEKLY })).toBeChecked());
    const [item] = await api.listTasks();
    expect(item?.completedWeeks).toEqual(['2026-09-28']);

    // Uncompleting a scored task asks first, because its score is deleted too.
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    await user.click(screen.getByRole('checkbox', { name: WEEKLY }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Mark not done' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: WEEKLY })).not.toBeChecked());
  });

  it('adds a task and a sub-task, shows progress, and collapses the parent', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expect(within(dialog).getByText('Enter a title.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Title'), 'Chapter 3 exercises');
    const forSelect = within(dialog).getByLabelText('For');
    await user.selectOptions(forSelect, within(forSelect).getByRole('option', { name: /Maths/ }));
    await user.type(within(dialog).getByLabelText('Due date (optional)'), '2026-10-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    const parent = await screen.findByRole('button', { name: /Chapter 3 exercises/ });
    expect(within(parent).getByText('Overdue')).toBeInTheDocument();

    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    await user.click(parent);
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add sub-task' }));
    dialog = await screen.findByRole('dialog', { name: 'Add a sub-task' });
    expect(within(dialog).getByLabelText('For')).toHaveDisplayValue(/Maths/);
    await user.type(within(dialog).getByLabelText('Title'), 'Exercise 3.1');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await screen.findByLabelText('0 of 1 sub-tasks done')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Exercise 3.1' }));
    expect(await screen.findByLabelText('1 of 1 sub-tasks done')).toBeInTheDocument();
    // TASK-9: parents are never completed automatically.
    expect(screen.getByRole('checkbox', { name: 'Chapter 3 exercises' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Collapse Chapter 3 exercises' }));
    expect(screen.queryByRole('checkbox', { name: 'Exercise 3.1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Chapter 3 exercises' }));
    expect(screen.getByRole('checkbox', { name: 'Exercise 3.1' })).toBeInTheDocument();
  });

  it('filters to tasks due this week and deletes a task with its sub-tasks', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const maths = (await api.listTree()).find((n) => n.name === 'Maths');
    if (!maths) throw new Error('seed has no Maths');
    const later = await api.createTask({ nodeId: maths.id, title: 'Later', dueOn: '2026-12-01' });
    await api.createTask({ nodeId: maths.id, parentTaskId: later.id, title: 'Later part' });
    renderRoutes('/tasks?filter=due', api);

    expect(await screen.findByRole('checkbox', { name: WEEKLY })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Later' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(await screen.findByRole('button', { name: /^Later\s*Due/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete…' }));
    expect(within(dialog).getByText(/and its 1 sub-task\?/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(async () => expect(await api.listTasks()).toHaveLength(1));
  });

  it('adds a task under Other and one for a new track', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/tasks', api);

    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Renew library card');
    await user.selectOptions(within(dialog).getByLabelText('For'), 'Other (no track)');
    expect(
      within(dialog).queryByLabelText('Record a score when it’s done'),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Renew library card' })).toBeInTheDocument();

    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'));
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Book the test');
    await user.selectOptions(within(dialog).getByLabelText('For'), '+ New track…');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expect(within(dialog).getByText('Enter a name for the new track.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('New track name'), 'Driving');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('heading', { name: 'Driving' })).toBeInTheDocument();
    const tracks = (await api.listTree()).filter((n) => n.depth === 1).map((n) => n.name);
    expect(tracks).toContain('Driving');
  });
});
