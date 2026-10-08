// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { DataExport, Report, SharedReportLink } from '../../src/core/domain/types';
import { createLoginHandler } from '../functions/auth-login';
import { createExportHandler } from '../functions/data-export';
import { createPublicShareHandler } from '../functions/public-share';
import { createReportsHandler } from '../functions/reports';
import { createShareHandler } from '../functions/share';
import { createSharesHandler } from '../functions/shares';
import { context, cookieFrom, LOGIN, post, testDeps } from './fakes';

const DAY = 86_400_000;

async function setup() {
  const t = testDeps();
  const getDeps = () => t.deps;
  const login = async (body: { email: string; password: string }) =>
    cookieFrom(await createLoginHandler(getDeps)(post('/api/auth/login', body), context));
  const cookie = await login(LOGIN);
  const request = (
    method: string,
    path: string,
    body?: unknown,
    withCookie: string | null = cookie,
  ) =>
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(withCookie ? { cookie: withCookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    ...t,
    login,
    request,
    reports: createReportsHandler(getDeps),
    shares: createSharesHandler(getDeps),
    share: createShareHandler(getDeps),
    publicShare: createPublicShareHandler(getDeps),
    exportData: createExportHandler(getDeps),
  };
}

async function createLink(t: Awaited<ReturnType<typeof setup>>, body: unknown, cookie?: string) {
  const res = await t.shares(t.request('POST', '/api/shares', body, cookie), context);
  expect(res.status).toBe(201);
  return ((await res.json()) as { share: SharedReportLink }).share;
}

describe('/api/reports (REP-9)', () => {
  it('requires a session and builds the report', async () => {
    const t = await setup();
    const body = { period: 'this_week' };
    expect((await t.reports(t.request('POST', '/api/reports', body, null), context)).status).toBe(
      401,
    );
    const res = await t.reports(t.request('POST', '/api/reports', body), context);
    expect(res.status).toBe(200);
    const { report } = (await res.json()) as { report: Report };
    expect(report.period).toMatchObject({ from: '2026-09-28', to: '2026-10-04', isWeek: true });
    expect(report.tracks.map((tr) => tr.name)).toEqual([
      'German Language',
      'Improvement Exams',
      'Claude Certification',
    ]);
  });

  it('validates the period', async () => {
    const t = await setup();
    const bad = await t.reports(t.request('POST', '/api/reports', { period: 'month' }), context);
    expect(bad.status).toBe(400);
    const tooLong = await t.reports(
      t.request('POST', '/api/reports', { period: 'custom', from: '2026-01-01', to: '2026-10-01' }),
      context,
    );
    expect(tooLong.status).toBe(400);
  });
});

describe('/api/shares and /api/share/:slug (SHARE-1–4)', () => {
  it('creates a link anyone can read, without login, marked noindex', async () => {
    const t = await setup();
    const link = await createLink(t, { report: { period: 'today' } });
    expect(link.expiresAt).toBe(new Date(t.deps.clock().getTime() + 30 * DAY).toISOString());

    const res = await t.publicShare(t.request('GET', `/api/share/${link.slug}`, undefined, null), {
      ...context,
      params: { slug: link.slug },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const { report } = (await res.json()) as { report: Report };
    expect(report.period.kind).toBe('today');
    expect(report.includesNotes).toBe(false);
  });

  it('lists links and revokes them; revoked, expired, and unknown links all say the same', async () => {
    const t = await setup();
    const link = await createLink(t, { report: { period: 'today' }, expiresInDays: 7 });
    const read = (slug: string) =>
      t.publicShare(t.request('GET', `/api/share/${slug}`, undefined, null), {
        ...context,
        params: { slug },
      });

    const list = await t.shares(t.request('GET', '/api/shares'), context);
    expect(((await list.json()) as { shares: SharedReportLink[] }).shares).toHaveLength(1);

    t.advance(8 * DAY);
    const expired = await read(link.slug);
    expect(expired.status).toBe(404);
    expect(await expired.json()).toEqual({
      error: { code: 'share_unavailable', message: 'This report is no longer available.' },
    });

    const fresh = await createLink(t, { report: { period: 'today' }, expiresInDays: null });
    const revoke = await t.share(t.request('DELETE', `/api/shares/${fresh.id}`), {
      ...context,
      params: { id: fresh.id },
    });
    expect(revoke.status).toBe(200);
    expect(((await revoke.json()) as { share: SharedReportLink }).share.revokedAt).not.toBeNull();
    expect((await read(fresh.slug)).status).toBe(404);
    expect((await read('not-a-real-slug-at-all-xxxxxx')).status).toBe(404);
    expect((await read('bad slug!')).status).toBe(404);
  });

  it('never lets one user list or revoke another user’s links (ACCT-5)', async () => {
    const t = await setup();
    const link = await createLink(t, { report: { period: 'today' } });
    t.auth.addUser('other@example.com', 'another password 1');
    const other = await t.login({ email: 'other@example.com', password: 'another password 1' });

    const list = await t.shares(t.request('GET', '/api/shares', undefined, other), context);
    expect(((await list.json()) as { shares: SharedReportLink[] }).shares).toEqual([]);
    const revoke = await t.share(t.request('DELETE', `/api/shares/${link.id}`, undefined, other), {
      ...context,
      params: { id: link.id },
    });
    expect(revoke.status).toBe(404);
  });

  it('requires a session to create or list links', async () => {
    const t = await setup();
    const res = await t.shares(
      t.request('POST', '/api/shares', { report: { period: 'today' } }, null),
      context,
    );
    expect(res.status).toBe(401);
  });
});

describe('/api/export (SET-2)', () => {
  it('returns all data and records the export time', async () => {
    const t = await setup();
    expect(
      (await t.exportData(t.request('POST', '/api/export', undefined, null), context)).status,
    ).toBe(401);
    const res = await t.exportData(t.request('POST', '/api/export'), context);
    expect(res.status).toBe(200);
    const data = (await res.json()) as DataExport;
    expect(data.app).toBe('Streakwise');
    expect(data.nodes).toHaveLength(7);
    expect((await t.repo.getSettings()).lastExportAt).toBe(data.exportedAt);
  });
});
