import type { Clock } from '../domain/types.js';
import { studyDate } from '../logic/dates.js';
import type { Repository } from '../repo/Repository.js';

// DAY-2: every "today" is the study day of the current time under the user's "My day ends at"
// setting. Services read the setting once per call through this helper.

export async function studyToday(repo: Repository, clock: Clock): Promise<string> {
  const { dayEndsAtMinutes } = await repo.getSettings();
  return studyDate(clock(), dayEndsAtMinutes);
}
