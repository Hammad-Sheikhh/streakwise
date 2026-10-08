import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryRepository } from '../repo/InMemoryRepository';
import { exportData, isBackupDue, sessionsCsv } from './exports';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';

let now = new Date('2026-10-03T10:00:00Z');
const clock = () => now;
let repo: InMemoryRepository;
let newId: () => string;

beforeEach(async () => {
  now = new Date('2026-10-03T10:00:00Z');
  repo = new InMemoryRepository(clock);
  let n = 0;
  newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  await seedIfEmpty(repo, newId);
});

async function nodeId(name: string): Promise<string> {
  const node = (await repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node.id;
}

describe('exportData (SET-2)', () => {
  it('returns everything and records the export time', async () => {
    await logSession(repo, clock, newId, {
      nodeId: await nodeId('Self-study'),
      studiedOn: '2026-10-02',
      minutes: 45,
    });
    expect((await repo.getSettings()).lastExportAt).toBeNull();

    const data = await exportData(repo, clock);
    expect(data).toMatchObject({
      app: 'Streakwise',
      formatVersion: 1,
      exportedAt: now.toISOString(),
    });
    expect(data.nodes).toHaveLength(7);
    expect(data.sessions).toHaveLength(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.sharedReports).toEqual([]);
    expect((await repo.getSettings()).lastExportAt).toBe(now.toISOString());
  });
});

describe('sessionsCsv (SET-2)', () => {
  it('writes one row per session with the path split into columns', async () => {
    await logSession(repo, clock, newId, {
      nodeId: await nodeId('Self-study'),
      studiedOn: '2026-10-01',
      minutes: 30,
      note: 'Said "hallo", then left',
    });
    await logSession(repo, clock, newId, {
      nodeId: await nodeId('Claude Certification'),
      studiedOn: '2026-10-02',
      minutes: 60,
      note: '=HYPERLINK("x")',
    });
    const csv = sessionsCsv(await repo.listNodes(), await repo.listAllSessions());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe('date,track,subtask,topic,minutes,note,source,created_at');
    expect(lines[1]).toMatch(
      /^2026-10-01,German Language,Self-study,,30,"Said ""hallo"", then left",app,/,
    );
    // A note that looks like a formula is neutralised.
    expect(lines[2]).toMatch(/^2026-10-02,Claude Certification,,,60,"'=HYPERLINK\(""x""\)",app,/);
  });
});

describe('isBackupDue (SET-3)', () => {
  it('is due with no export or one older than 30 days', () => {
    expect(isBackupDue(null, now)).toBe(true);
    expect(isBackupDue('2026-09-03T10:00:00Z', now)).toBe(false);
    expect(isBackupDue('2026-09-03T09:59:00Z', now)).toBe(true);
  });
});
