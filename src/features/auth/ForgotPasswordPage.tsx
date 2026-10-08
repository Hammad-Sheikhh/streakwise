import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { useAccount } from './useAccount';

// ACCT-4: asks for a reset link. The answer never says whether the email has an account.
export function ForgotPasswordPage() {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const send = useMutation({ mutationFn: () => account.forgotPassword({ email }) });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send.mutate();
  }

  if (send.isSuccess) {
    return (
      <AuthLayout description="Check your email.">
        <p role="status">
          If <strong>{email.trim()}</strong> has an account, we’ve sent it a link to choose a new
          password. Check your spam folder too.
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link to="/login">Back to log in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout description="We’ll email you a link to choose a new password.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={send.error?.message}
          required
          autoFocus
        />
        <Button type="submit" className="h-11" disabled={send.isPending || email.trim() === ''}>
          {send.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link to="/login" className="text-center text-sm underline underline-offset-4">
          Back to log in
        </Link>
      </form>
    </AuthLayout>
  );
}
