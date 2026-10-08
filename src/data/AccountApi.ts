import type { ClaudeConnection } from '@/core/domain/types';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  EmailInput,
  LoginInput,
  Me,
  PasscodeInput,
  SignUpInput,
  SignUpResult,
} from '@/core/schemas/auth';

// Accounts (ACCT-1–9) exist only in the real app; demo mode has none (DataSource.account is null).
export interface AccountApi {
  me(): Promise<Me>;
  /** `claimed`: the data from before accounts moved into this account (ACCT-7). */
  login(input: LoginInput): Promise<{ claimed: boolean }>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  /** ACCT-7: lets this browser's next login or sign-up claim the data from before accounts. */
  enterPasscode(input: PasscodeInput): Promise<void>;
  forgotPassword(input: EmailInput): Promise<void>;
  resendConfirmation(input: EmailInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  deleteAccount(input: DeleteAccountInput): Promise<void>;
  /** ACCT-8: makes a new Claude link (the old one stops working); the URL is only shown now. */
  createClaudeLink(): Promise<ClaudeConnection>;
}
