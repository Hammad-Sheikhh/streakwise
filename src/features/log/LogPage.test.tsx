import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { FakeApi } from '@/test/fakeApi';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

// TEST_NOW is 2026-10-03 15:00 in Karachi.
const TODAY = '2026-10-03';

async function nodeId(api: FakeApi, name: string): Promise<string> {
  const node = (await api.listTree()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

/** The heading shows at once; the form appears when the tree has loaded. */
const formLoaded = () => screen.findByLabelText('Track');

async function openLog(path = '/log') {
  const user = userEvent.setup();
  const api = fakeApi({ loggedIn: true });
  const result = renderRoutes(path, api);
  await formLoaded();
  return { user, api, ...result };
}

describe('Log form (LOG-2–5)', () => {
  it('explains what is missing instead of saving', async () => {
    const { user, api } = await openLog();
    await user.click(screen.getByRole('button', { name: 'Save session' }));

    expect(screen.getByText('Choose what you studied.')).toBeInTheDocument();
    expect(screen.getByText('Enter between 1 minute and 24 hours.')).toBeInTheDocument();
    expect(screen.getByLabelText('Track')).toHaveAttribute('aria-invalid', 'true');
    expect((await api.getHistory({})).days).toHaveLength(0);
  });

  it('picks a track, then a subtask, then a new topic (LOG-2, LOG-8)', async () => {
    const { user, api } = await openLog();
    expect(screen.queryByLabelText('Subtask (optional)')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Track'), 'Improvement Exams');
    const subtask = screen.getByLabelText('Subtask (optional)');
    expect(
      within(subtask)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Whole track', 'Maths', 'English']);

    await user.selectOptions(subtask, 'Maths');
    await user.click(screen.getByRole('button', { name: '+ New topic' }));
    await user.type(screen.getByLabelText('New topic name'), 'Algebra');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const topic = await screen.findByLabelText('Topic (optional)');
    await waitFor(() =>
      expect(within(topic).getByRole('option', { name: 'Algebra' })).toHaveProperty(
        'selected',
        true,
      ),
    );
    expect((await api.listTree()).some((n) => n.name === 'Algebra' && n.depth === 3)).toBe(true);
  });

  it('adds a new track from the track picker and selects it', async () => {
    const { user, api } = await openLog();
    await user.selectOptions(screen.getByLabelText('Track'), '+ New track…');
    await user.type(screen.getByLabelText('New track name'), 'Piano{Enter}');

    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Track')).getByRole('option', { name: 'Piano' }),
      ).toHaveProperty('selected', true),
    );
    expect(screen.queryByLabelText('New track name')).not.toBeInTheDocument();
    expect((await api.listTree()).some((n) => n.name === 'Piano' && n.depth === 1)).toBe(true);
  });

  it('fills hours and minutes from the duration chips (LOG-4)', async () => {
    const { user } = await openLog();
    await user.click(screen.getByRole('button', { name: '45m' }));
    expect(screen.getByLabelText('Hours')).toHaveValue(0);
    expect(screen.getByLabelText('Minutes')).toHaveValue(45);
    expect(screen.getByRole('button', { name: '45m' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '1.5h' }));
    expect(screen.getByLabelText('Hours')).toHaveValue(1);
    expect(screen.getByLabelText('Minutes')).toHaveValue(30);
  });

  it('rejects a duration over 24 hours and a future date (LOG-3, LOG-4)', async () => {
    const { user } = await openLog();
    await user.type(screen.getByLabelText('Hours'), '25');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-10-04');
    await user.click(screen.getByRole('button', { name: 'Save session' }));

    expect(screen.getByText('Enter between 1 minute and 24 hours.')).toBeInTheDocument();
    expect(screen.getByText('You can’t log time in the future.')).toBeInTheDocument();
  });

  it('switches the date with the Today and Yesterday chips', async () => {
    const { user } = await openLog();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    await user.click(screen.getByRole('button', { name: 'Yesterday' }));
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-02');
    expect(screen.getByRole('button', { name: 'Yesterday' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('logging a session (LOG-1, LOG-6, LOG-7, LOG-9, LOG-10)', () => {
  it('saves, returns Home, and offers Undo', async () => {
    const { user, api, router } = await openLog();
    await user.selectOptions(screen.getByLabelText('Track'), 'German Language');
    await user.selectOptions(screen.getByLabelText('Subtask (optional)'), 'Class');
    await user.click(screen.getByRole('button', { name: '30m' }));
    await user.type(screen.getByLabelText('Note (optional)'), 'Dative case');
    await user.click(screen.getByRole('button', { name: 'Save session' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const [day] = (await api.getHistory({})).days;
    expect(day?.sessions[0]).toMatchObject({
      nodeId: await nodeId(api, 'Class'),
      studiedOn: TODAY,
      minutes: 30,
      note: 'Dative case',
    });

    expect(await screen.findByText('Logged 30m · Class')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await api.getHistory({})).days).toHaveLength(0));
  });

  it('preselects ?node= and its parents', async () => {
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    renderRoutes(`/log?node=${maths}`, api);
    await formLoaded();
    expect(screen.getByLabelText('Track')).toHaveDisplayValue('Improvement Exams');
    expect(screen.getByLabelText('Subtask (optional)')).toHaveDisplayValue('Maths');
  });

  it('offers recent nodes as one-tap shortcuts', async () => {
    const api = fakeApi({ loggedIn: true });
    await api.logSession({ nodeId: await nodeId(api, 'English'), studiedOn: TODAY, minutes: 20 });
    const user = userEvent.setup();
    renderRoutes('/log', api);

    const shortcut = await screen.findByRole('button', { name: 'Improvement Exams › English' });
    await user.click(shortcut);
    expect(screen.getByLabelText('Subtask (optional)')).toHaveDisplayValue('English');
  });

  it('warns softly when the day would pass 16 hours', async () => {
    const api = fakeApi({ loggedIn: true });
    const maths = await nodeId(api, 'Maths');
    await api.logSession({ nodeId: maths, studiedOn: TODAY, minutes: 900 });
    const user = userEvent.setup();
    renderRoutes('/log', api);
    await formLoaded();

    await user.click(screen.getByRole('button', { name: '2h' }));
    expect(await screen.findByText(/more than 16 hours/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save session' })).toBeEnabled();
  });
});
