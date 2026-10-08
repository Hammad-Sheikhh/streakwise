import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import { newShareSlug, SLUG_PATTERN } from '../logic/slug';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';
import { createShare, listShares, publicSnapshot, revokeShare, shareStatus } from './shares';

let now = new Date('2026-10-03T10:00:00Z');
const clock = () => now;
let repo: InMemoryRepository;
let ids: { newId: () => string; newSlug: () => string };

const DAY = 86_400_000;
const later = (days: number) => new Date(now.getTime() + days * DAY);

beforeEach(async () => {
  now = new Date('2026-10-03T10:00:00Z');
  repo = new InMemoryRepository(clock);
  let n = 0;
  let s = 0;
  ids = {
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    newSlug: () => `slug-${String(++s).padStart(24, '0')}`,
  };
  await seedIfEmpty(repo, ids.newId);
});

describe('newShareSlug (SHARE-1)', () => {
  it('makes 32 random URL-safe characters', () => {
    const a = newShareSlug();
    expect(a).toMatch(SLUG_PATTERN);
    expect(a).toHaveLength(32);
    expect(a).not.toBe(newShareSlug());
  });
});

describe('share links (SHARE-1–6)', () => {
  it('stores a frozen snapshot that later changes don’t affect', async () => {
    const node = (await repo.listNodes())[1];
    if (!node) throw new Error('seed missing');
    const log = (minutes: number) =>
      logSession(repo, clock, ids.newId, { nodeId: node.id, studiedOn: '2026-10-03', minutes });
    await log(30);
    const link = await createShare(repo, clock, ids, { report: { period: 'this_week' } });
    expect(link).toMatchObject({
      periodLabel: 'This week (28 Sep – 4 Oct 2026)',
      revokedAt: null,
      // SHARE-5: 30 days by default.
      expiresAt: later(30).toISOString(),
    });

    await log(60);
    const share = await repo.findSharedReport(link.slug);
    expect(publicSnapshot(share, now)?.totals.minutes).toBe(30);
  });

  it('respects the notes toggle', async () => {
    const link = await createShare(repo, clock, ids, {
      report: { period: 'today', includeNotes: true },
    });
    expect((await repo.findSharedReport(link.slug))?.snapshot.includesNotes).toBe(true);
  });

  it('offers 7 days, 30 days, or never (SHARE-6)', async () => {
    const week = await createShare(repo, clock, ids, {
      report: { period: 'today' },
      expiresInDays: 7,
    });
    const never = await createShare(repo, clock, ids, {
      report: { period: 'today' },
      expiresInDays: null,
    });
    expect(week.expiresAt).toBe(later(7).toISOString());
    expect(never.expiresAt).toBeNull();
    await expect(
      createShare(repo, clock, ids, { report: { period: 'today' }, expiresInDays: 3 as 7 }),
    ).rejects.toThrow(DomainError);
  });

  it('hides expired and revoked links (SHARE-4)', async () => {
    const link = await createShare(repo, clock, ids, {
      report: { period: 'today' },
      expiresInDays: 7,
    });
    expect(shareStatus(link, now)).toBe('active');
    expect(shareStatus(link, later(7))).toBe('expired');
    expect(publicSnapshot(await repo.findSharedReport(link.slug), later(8))).toBeNull();

    const revoked = await revokeShare(repo, clock, link.id);
    expect(revoked.revokedAt).toBe(now.toISOString());
    expect(shareStatus(revoked, now)).toBe('revoked');
    expect(publicSnapshot(await repo.findSharedReport(link.slug), now)).toBeNull();
    expect(publicSnapshot(null, now)).toBeNull();

    // Revoking again keeps the first time.
    const first = revoked.revokedAt;
    now = later(1);
    expect((await revokeShare(repo, clock, link.id)).revokedAt).toBe(first);
    await expect(revokeShare(repo, clock, 'missing')).rejects.toThrow(DomainError);
  });

  it('lists links newest first, without snapshots', async () => {
    await createShare(repo, clock, ids, { report: { period: 'today' } });
    await createShare(repo, clock, ids, { report: { period: 'last_week' } });
    const links = await listShares(repo);
    expect(links.map((l) => l.periodLabel)).toEqual([
      'Last week (21 Sep – 27 Sep 2026)',
      'Today (Sat 3 Oct 2026)',
    ]);
    expect(links[0]).not.toHaveProperty('snapshot');
  });
});
