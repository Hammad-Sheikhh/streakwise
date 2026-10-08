import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { signUpInputSchema } from '@/core/schemas/auth';
import type { SignUpInput } from '@/core/schemas/auth';

import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { useAccount } from './useAccount';

type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

// ACCT-1, ACCT-2: open sign-up. Usually ends with "check your email"; if the server doesn't send
// confirmation emails yet, the new account is logged in at once.
export function SignUpPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const signUp = useMutation({
    mutationFn: (input: SignUpInput) => account.signUp(input),
    onSuccess: async ({ status }) => {
      if (status === 'signed_in') {
        await queryClient.invalidateQueries();
        void navigate('/', { replace: true });
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signUpInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof SignUpInput;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    signUp.mutate(parsed.data);
  }

  if (signUp.data?.status === 'confirm_email') {
    return (
      <AuthLayout description="Check your email.">
        <p role="status">
          We sent a confirmation link to <strong>{form.email.trim()}</strong>. Open it to finish
          creating your account.
        </p>
        <p className="text-sm text-muted-foreground">
          Nothing there after a few minutes? Check your spam or junk folder.
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link to="/login">Back to log in</Link>
        </Button>
      </AuthLayout>
    );
  }

  const update = (field: keyof SignUpInput) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <AuthLayout description="Create your account.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          label="Your name"
          autoComplete="name"
          maxLength={80}
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
          required
          autoFocus
        />
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          required
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          required
        />
        {signUp.error && (
          <p role="alert" className="text-sm text-destructive">
            {signUp.error.message}
          </p>
        )}
        <Button type="submit" className="h-11" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="underline underline-offset-4">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
