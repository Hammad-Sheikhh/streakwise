import type { Settings } from '../domain/types';
import type { Repository } from '../repo/Repository';
import { updateSettingsInputSchema } from '../schemas/inputs';
import type { UpdateSettingsInput } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// SET-1: student name and neglect threshold.
export async function updateSettings(
  repo: Repository,
  rawInput: UpdateSettingsInput,
): Promise<Settings> {
  return repo.updateSettings(parseInput(updateSettingsInputSchema, rawInput));
}
