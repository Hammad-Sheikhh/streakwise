import { z } from 'zod';

// Accounts (ACCT-1–10). Shared by the API (validation) and the UI (forms, response parsing).

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Please enter a valid email address.').max(254));

/** Supabase Auth (bcrypt) uses at most 72 bytes of a password. */
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.');

/** Any length is accepted when checking an existing password; the server just compares it. */
const existingPassword = z.string().min(1, 'Enter your password.').max(200);

export const signUpInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email,
  password: newPassword,
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const loginInputSchema = z.object({ email, password: existingPassword });
export type LoginInput = z.infer<typeof loginInputSchema>;

/** ACCT-7: the old single-user passcode, used once to claim the data from before accounts. */
export const passcodeInputSchema = z.object({
  passcode: z.string().min(1, 'Enter your passcode.').max(200),
});
export type PasscodeInput = z.infer<typeof passcodeInputSchema>;

export const emailInputSchema = z.object({ email });
export type EmailInput = z.infer<typeof emailInputSchema>;

/** The current password isn't needed right after following a reset link (ACCT-4). */
export const changePasswordInputSchema = z.object({
  currentPassword: existingPassword.optional(),
  newPassword,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const deleteAccountInputSchema = z.object({
  password: existingPassword,
  confirm: z.literal('DELETE', 'Type DELETE to confirm.'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

export const meSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({ email: z.string(), name: z.string() }).optional(),
  /** True right after a reset link: the password form doesn't ask for the old password. */
  recovering: z.boolean().optional(),
});
export type Me = z.infer<typeof meSchema>;

export const signUpResultSchema = z.object({
  status: z.enum(['confirm_email', 'signed_in']),
});
export type SignUpResult = z.infer<typeof signUpResultSchema>;
