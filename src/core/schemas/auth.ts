import { z } from 'zod';

export const loginInputSchema = z.object({
  passcode: z.string().min(1, 'Enter your passcode.').max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const meSchema = z.object({ authenticated: z.boolean() });
export type Me = z.infer<typeof meSchema>;
