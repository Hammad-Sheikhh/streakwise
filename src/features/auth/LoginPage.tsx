import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DataSourceError } from '@/data/DataSource';

import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { useAccount } from './useAccount';

const LINK_MESSAGES: Record<string, string> = {
  expired: 'That link has expired or was already used. Log in, or ask for a new link.',
  invalid: 'That link isn’t complete. Try opening it from the email again.',
  error: 'Something went wrong with that link. Please try again.',
};

// ACCT-3: email + password login, links to sign-up and password reset, the old-passcode claim
// (ACCT-7), and the demo. Makes no request until the visitor acts, so the demo stays offline.
export function LoginPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => account.login({ email, password }),
    onSuccess: async ({ claimed }) => {
      if (claimed) toast.success('Your existing data is now in this account.');
      await queryClient.invalidateQueries();
      void navigate('/', { replace: true });
    },
  });

  const resend = useMutation({
    mutationFn: () => account.resendConfirmation({ email }),
    onSuccess: () => toast.success('Sent. Check your inbox and spam folder.'),
    onError: (error) => toast.error(error.message),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate();
  }

  const linkMessage = LINK_MESSAGES[searchParams.get('link') ?? ''];
  const notConfirmed =
    login.error instanceof DataSourceError && login.error.code === 'email_not_confirmed';

  return (
    <AuthLayout description="Log in to continue.">
      {linkMessage && (
        <p role="status" className="rounded-md border bg-muted p-3 text-sm">
          {linkMessage}
        </p>
      )}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={login.error?.message}
          required
        />
        {notConfirmed && (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
          >
            Send the confirmation email again
          </Button>
        )}
        <Button
          type="submit"
          className="h-11"
          disabled={login.isPending || email.trim() === '' || password === ''}
        >
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link to="/forgot-password" className="underline underline-offset-4">
            Forgot password?
          </Link>
          <Link to="/signup" className="underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </form>

      <OldPasscode />

      <div className="flex flex-col gap-2 border-t pt-6 text-center">
        <p className="text-sm text-muted-foreground">Just looking around?</p>
        <Button asChild variant="outline" className="h-11">
          <Link to="/demo">Try the demo</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

/** ACCT-7: the owner's way to move the data from before accounts into their account. */
function OldPasscode() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const enter = useMutation({ mutationFn: () => account.enterPasscode({ passcode }) });

  if (!open) {
    return (
      <Button
        variant="link"
        className="h-auto self-center p-0 text-sm text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Used Streakwise before accounts?
      </Button>
    );
  }

  if (enter.isSuccess) {
    return (
      <p role="status" className="rounded-md border bg-muted p-3 text-sm">
        Passcode accepted. Now log in, or create an account and confirm it from this browser: your
        existing data will move into that account.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        enter.mutate();
      }}
      noValidate
    >
      <AuthField
        label="Old passcode"
        hint="Enter it once to move your existing data into your account."
        type="password"
        autoComplete="off"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        error={enter.error?.message}
        required
        autoFocus
      />
      <Button
        type="submit"
        variant="outline"
        className="h-11"
        disabled={enter.isPending || passcode === ''}
      >
        Continue
      </Button>
    </form>
  );
}
