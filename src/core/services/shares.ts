import type {
  Clock,
  IdGenerator,
  Report,
  SharedReport,
  SharedReportLink,
  ShareStatus,
} from '../domain/types';
import { formatRange } from '../logic/labels';
import type { SlugGenerator } from '../logic/slug';
import type { Repository } from '../repo/Repository';
import { createShareInputSchema } from '../schemas/inputs';
import type { CreateShareInput } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';
import { buildReport } from './reports';

// SHARE-1–6: frozen report snapshots behind unguessable links.

const DAY_MS = 86_400_000;

/** e.g. "This week (6 – 12 Oct 2026)". */
export function shareLabel(period: Report['period']): string {
  return `${period.label} (${formatRange(period.from, period.to)})`;
}

/**
 * SHARE-1: builds the report on the server (so a link can't show made-up numbers) and stores it
 * as a frozen snapshot that later changes to the data don't affect.
 */
export async function createShare(
  repo: Repository,
  clock: Clock,
  ids: { newId: IdGenerator; newSlug: SlugGenerator },
  rawInput: CreateShareInput,
): Promise<SharedReportLink> {
  const input = parseInput(createShareInputSchema, rawInput);
  const snapshot = await buildReport(repo, clock, input.report);
  const expiresAt =
    input.expiresInDays === null
      ? null
      : new Date(clock().getTime() + input.expiresInDays * DAY_MS).toISOString();
  return repo.insertSharedReport({
    id: ids.newId(),
    slug: ids.newSlug(),
    snapshot,
    periodLabel: shareLabel(snapshot.period),
    expiresAt,
  });
}

export async function listShares(repo: Repository): Promise<SharedReportLink[]> {
  return repo.listSharedReports();
}

export async function revokeShare(
  repo: Repository,
  clock: Clock,
  id: string,
): Promise<SharedReportLink> {
  return repo.revokeSharedReport(id, clock().toISOString());
}

export function shareStatus(link: SharedReportLink, now: Date): ShareStatus {
  if (link.revokedAt !== null) return 'revoked';
  if (link.expiresAt !== null && new Date(link.expiresAt).getTime() <= now.getTime()) {
    return 'expired';
  }
  return 'active';
}

/** SHARE-4: the snapshot a public link may show, or null when it's unknown, expired, or revoked. */
export function publicSnapshot(share: SharedReport | null, now: Date): Report | null {
  return share && shareStatus(share, now) === 'active' ? share.snapshot : null;
}
