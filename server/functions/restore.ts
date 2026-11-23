import { MAX_BACKUP_BYTES, restoreFromBackup } from '../../src/core/services/backup.js';
import { apiHandler } from './_lib/api.js';
import type { ServerDeps } from './_lib/deps.js';
import { HttpError, json } from './_lib/http.js';

const tooLarge = () => new HttpError(413, 'too_large', 'Backups can be at most 4 MB.');

// DATA-3, DATA-4: replace all study data with a backup file (format 1 or 2). The file is checked
// as a whole first; the app has already downloaded a fresh backup before calling this.
export function createRestoreHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'restore', auth: true }, getDeps, async ({ request, deps }) => {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BACKUP_BYTES) throw tooLarge();
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw tooLarge();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'invalid_json', 'This file isn’t a Streakwise backup (not JSON).');
    }
    return json({ summary: await restoreFromBackup(deps.repo, deps.newId, raw) });
  });
}
