import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { SharedReport } from '../../../src/core/domain/types';
import { reportSchema } from '../../../src/core/schemas/domain';
import { throwDbError } from './dbErrors';
import { SHARED_REPORT_LINK_COLUMNS, sharedReportRow } from './SupabaseRepository';

// SHARE-2: the one read that isn't limited to a logged-in user. It finds a link by its slug,
// which is unguessable (SHARE-1), and returns nothing else of the owner's data.

export interface PublicShareStore {
  findBySlug(slug: string): Promise<SharedReport | null>;
}

const snapshotRow = z.object({ snapshot: reportSchema });

export class SupabasePublicShareStore implements PublicShareStore {
  constructor(private readonly db: SupabaseClient) {}

  async findBySlug(slug: string): Promise<SharedReport | null> {
    const { data, error } = await this.db
      .from('shared_reports')
      .select(`${SHARED_REPORT_LINK_COLUMNS}, snapshot`)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throwDbError(error);
    if (data === null) return null;
    return { ...sharedReportRow.parse(data), ...snapshotRow.parse(data) };
  }
}
