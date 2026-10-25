import type { Settings } from '../domain/types.js';
import type { Repository } from '../repo/Repository.js';
import { updateSettingsInputSchema } from '../schemas/inputs.js';
import type { UpdateSettingsInput } from '../schemas/inputs.js';
import { parseInput } from '../schemas/parse.js';

// SET-1: student name and neglect threshold.
export async function updateSettings(
  repo: Repository,
  rawInput: UpdateSettingsInput,
): Promise<Settings> {
  return repo.updateSettings(parseInput(updateSettingsInputSchema, rawInput));
}
