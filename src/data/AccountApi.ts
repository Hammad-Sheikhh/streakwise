import type { ClaudeConnection } from '@/core/domain/types';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  EmailInput,
  LoginInput,
  Me,
  SignUpInput,
  SignUpResult,
} from '@/core/schemas/auth';

// Accounts (ACCT-1–9) exist only in the real app; demo mode has none (DataSource.account is null).
export interface AccountApi {
  me(): Promise<Me>;
  login(input: LoginInput): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  forgotPassword(input: EmailInput): Promise<void>;
  resendConfirmation(input: EmailInput): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  deleteAccount(input: DeleteAccountInput): Promise<void>;
  /** ACCT-8: makes a new Claude link (the old one stops working); the URL is only shown now. */
  createClaudeLink(): Promise<ClaudeConnection>;
}
