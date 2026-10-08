import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Report } from '@/core/domain/types';
import { fakeApi } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

afterEach(() => vi.restoreAllMocks());

describe('Settings → Shared links (SHARE-3)', () => {
  it('lists links and revokes one after confirming', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    await api.createShare({ report: { period: 'last_week' } });
    renderRoutes('/settings/shared-links', api);

    const item = (await screen.findByText('Last week (21 Sep – 27 Sep 2026)')).closest('li');
    if (!item) throw new Error('no list item');
    expect(within(item).getByText('Active')).toBeInTheDocument();
    expect(item).toHaveTextContent('Expires Mon 2 Nov 2026');

    await user.click(within(item).getByRole('button', { name: 'Revoke' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke' }),
    );
    expect(await within(item).findByText('Revoked')).toBeInTheDocument();
    expect(within(item).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('explains that links are off in the demo', async () => {
    renderRoutes('/demo/settings/shared-links', fakeApi());
    expect(await screen.findByText(/Share links are off in the demo/)).toBeInTheDocument();
  });
});

describe('Settings → Your data (SET-2, SET-3)', () => {
  it('reminds about backups, downloads JSON and CSV, and records the time', async () => {
    const user = userEvent.setup();
    const createUrl = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:test';
    });
    URL.createObjectURL = createUrl as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderRoutes('/settings', fakeApi({ loggedIn: true }));

    const section = await screen.findByRole('region', { name: 'Your data' });
    expect(await within(section).findByText(/haven’t downloaded a backup yet/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'All data (JSON)' }));
    expect(await within(section).findByText(/Last downloaded Sat 3 Oct 2026/)).toBeInTheDocument();
    expect(within(section).queryByText(/backup yet/)).not.toBeInTheDocument();
    const json = await (createUrl.mock.calls[0]?.[0] as Blob).text();
    expect(JSON.parse(json)).toMatchObject({ app: 'Streakwise', formatVersion: 1 });

    await user.click(within(section).getByRole('button', { name: 'Sessions (CSV)' }));
    const csv = await (createUrl.mock.calls[1]?.[0] as Blob).text();
    expect(csv).toContain('date,track,subtask,topic,minutes,note,source,created_at');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('shows the backup reminder on Home', async () => {
    renderRoutes('/', fakeApi({ loggedIn: true }));
    expect(await screen.findByText(/Time for a backup/)).toBeInTheDocument();
  });
});

describe('the public shared report (SHARE-2, SHARE-4)', () => {
  it('shows the report with no app navigation', async () => {
    const api = fakeApi({ loggedIn: true });
    const link = await api.createShare({ report: { period: 'this_week' } });
    const report: Report = await api.buildReport({ period: 'this_week' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ report }));
    renderRoutes(`/r/${link.slug}`, fakeApi());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Weekly study report' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Made with Streakwise')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/share/${link.slug}`,
      expect.objectContaining({ credentials: 'omit' }),
    );
  });

  it('says when a link is no longer available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: { code: 'share_unavailable', message: 'x' } }, { status: 404 }),
    );
    renderRoutes('/r/some-expired-slug-0000000000000', fakeApi());
    expect(
      await screen.findByRole('heading', { name: 'This report is no longer available.' }),
    ).toBeInTheDocument();
  });
});
