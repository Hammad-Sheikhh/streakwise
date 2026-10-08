import { z } from 'zod';

import type { Report } from '@/core/domain/types';
import { reportSchema } from '@/core/schemas/domain';

import { DataSourceError } from './DataSource';

// SHARE-2: the public page's only request. It needs no login and no data source.

const response = z.object({ report: reportSchema });

/** The shared report, or null when the link is unknown, expired, or revoked (SHARE-4). */
export async function fetchSharedReport(
  slug: string,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<Report | null> {
  let res: Response;
  try {
    res = await fetchFn(`/api/share/${encodeURIComponent(slug)}`, { credentials: 'omit' });
  } catch {
    throw new DataSourceError(0, 'network', 'Can’t reach the server. Check your connection.');
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new DataSourceError(res.status, 'unexpected', 'Something went wrong. Please try again.');
  }
  return response.parse(await res.json()).report;
}
