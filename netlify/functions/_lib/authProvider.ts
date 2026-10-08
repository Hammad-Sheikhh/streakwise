import { createClient, isAuthApiError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './http';

// ACCT-1: the server's only door to Supabase Auth. Tests use an in-memory fake (netlify/tests).
// Calls are made with the secret key from the server, so D5 still holds: the browser never talks
// to Supabase, and the links in emails point at our own /auth/confirm.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export type SignUpResult =
  /** Email confirmation is on: the user must click the link first. */
  | { kind: 'confirm_email' }
  /** Confirmation is off (no SMTP set up yet): the account can be used at once. */
  | { kind: 'signed_in'; user: AuthUser };

export type EmailLinkType = 'signup' | 'recovery';

// Email links: Supabase fills `{{ .RedirectTo }}` in our templates (docs/email-templates) with the
// `origin` passed below, so a link opens the site that sent it: <origin>/auth/confirm?token_hash=…

export interface AuthProvider {
  /** Never reveals whether the email already had an account when confirmation is on. */
  signUp(input: {
    email: string;
    password: string;
    name: string;
    origin: string;
  }): Promise<SignUpResult>;
  /** Raises HttpError 401 `wrong_login` or 403 `email_not_confirmed`. */
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Checks an email link's token hash; returns its user. Raises HttpError 400 `link_invalid`. */
  verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<AuthUser>;
  /** Silently does nothing for unknown emails (ACCT-4). */
  sendPasswordReset(email: string, origin: string): Promise<void>;
  resendConfirmation(email: string, origin: string): Promise<void>;
  getUser(userId: string): Promise<AuthUser | null>;
  setPassword(userId: string, password: string): Promise<void>;
  /** Deletes the account; the database cascades to all of the user's rows (0003). */
  deleteUser(userId: string): Promise<void>;
}

interface SupabaseUserLike {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

function toAuthUser(user: SupabaseUserLike): AuthUser {
  const name = user.user_metadata?.name;
  return { id: user.id, email: user.email ?? '', name: typeof name === 'string' ? name : '' };
}

const WEAK_PASSWORD = new HttpError(
  400,
  'weak_password',
  'Please choose a stronger password (at least 8 characters).',
);

const TOO_MANY_EMAILS = new HttpError(
  429,
  'email_rate_limited',
  'Too many emails were sent just now. Please try again in an hour.',
);

export class SupabaseAuthProvider implements AuthProvider {
  constructor(
    private readonly url: string,
    private readonly secretKey: string,
  ) {}

  // A fresh client per call: signing in stores a session on the client, which must never leak
  // into another request or into the database client (that would replace the secret key).
  private client(): SupabaseClient {
    return createClient(this.url, this.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async signUp(input: {
    email: string;
    password: string;
    name: string;
    origin: string;
  }): Promise<SignUpResult> {
    const { data, error } = await this.client().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name }, emailRedirectTo: input.origin },
    });
    if (error) {
      if (isAuthApiError(error)) {
        if (error.code === 'weak_password') throw WEAK_PASSWORD;
        if (error.code === 'over_email_send_rate_limit') throw TOO_MANY_EMAILS;
        if (error.code === 'user_already_exists' || error.code === 'email_exists') {
          // Only reachable while confirmation is off; with it on, Supabase hides duplicates.
          throw new HttpError(
            409,
            'email_taken',
            'An account with this email already exists. Try logging in.',
          );
        }
        if (error.code === 'email_address_invalid') {
          throw new HttpError(400, 'validation', 'Please enter a valid email address.');
        }
      }
      throw error;
    }
    if (data.session && data.user) return { kind: 'signed_in', user: toAuthUser(data.user) };
    return { kind: 'confirm_email' };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) {
      if (isAuthApiError(error) && error.code === 'email_not_confirmed') {
        throw new HttpError(
          403,
          'email_not_confirmed',
          'Please confirm your email first: open the link we sent you (check spam too).',
        );
      }
      if (isAuthApiError(error) && (error.status === 400 || error.code === 'invalid_credentials')) {
        throw new HttpError(401, 'wrong_login', 'That email and password don’t match.');
      }
      throw error;
    }
    return toAuthUser(data.user);
  }

  async verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<AuthUser> {
    const { data, error } = await this.client().auth.verifyOtp({
      token_hash: tokenHash,
      type: type === 'signup' ? 'email' : 'recovery',
    });
    if (error || !data.user) {
      if (!error || isAuthApiError(error)) {
        throw new HttpError(400, 'link_invalid', 'This link has expired or was already used.');
      }
      throw error;
    }
    return toAuthUser(data.user);
  }

  async sendPasswordReset(email: string, origin: string): Promise<void> {
    const { error } = await this.client().auth.resetPasswordForEmail(email, {
      redirectTo: origin,
    });
    if (error && isAuthApiError(error) && error.code === 'over_email_send_rate_limit') {
      throw TOO_MANY_EMAILS;
    }
    // Other errors (e.g. an unknown email) are not reported, so the answer never reveals accounts.
    if (error && !isAuthApiError(error)) throw error;
  }

  async resendConfirmation(email: string, origin: string): Promise<void> {
    const { error } = await this.client().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: origin },
    });
    if (error && isAuthApiError(error) && error.code === 'over_email_send_rate_limit') {
      throw TOO_MANY_EMAILS;
    }
    if (error && !isAuthApiError(error)) throw error;
  }

  async getUser(userId: string): Promise<AuthUser | null> {
    const { data, error } = await this.client().auth.admin.getUserById(userId);
    if (error) {
      if (isAuthApiError(error) && error.status === 404) return null;
      throw error;
    }
    return toAuthUser(data.user);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.client().auth.admin.updateUserById(userId, { password });
    if (error) {
      if (isAuthApiError(error) && error.code === 'weak_password') throw WEAK_PASSWORD;
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client().auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}
