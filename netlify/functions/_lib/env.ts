import { z } from 'zod';

// Server configuration from environment variables (set in `.env` locally and in Netlify).
// Only variable names ever appear in errors and logs, never values.

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  // ACCT-7: only used to claim the data from before accounts; can be removed afterwards.
  APP_PASSCODE: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32),
});
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class ConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Missing or invalid environment variables: ${variables.join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError([...new Set(result.error.issues.map((issue) => String(issue.path[0])))]);
  }
  return result.data;
}
