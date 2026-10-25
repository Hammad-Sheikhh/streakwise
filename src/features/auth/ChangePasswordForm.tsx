import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { changePasswordInputSchema } from '@/core/schemas/auth';

import { AuthField } from './AuthField.js';
import { formValue } from './formValues.js';
import { useAccount } from './useAccount.js';

/**
 * ACCT-4, ACCT-9: choose a new password, typed twice. The current password is asked for except
 * right after a reset link.
 */
export function ChangePasswordForm({
  requireCurrent,
  onDone,
}: {
  requireCurrent: boolean;
  onDone: () => void;
}) {
  const account = useAccount();
  const [formError, setFormError] = useState<string>();

  const change = useMutation({
    mutationFn: (input: { currentPassword?: string; newPassword: string }) =>
      account.changePassword(input),
    onSuccess: () => onDone(),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = formValue(event.currentTarget, 'currentPassword');
    const newPassword = formValue(event.currentTarget, 'newPassword');
    const repeat = formValue(event.currentTarget, 'repeat');
    const parsed = changePasswordInputSchema.shape.newPassword.safeParse(newPassword);
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message);
    if (newPassword !== repeat) return setFormError('The two new passwords don’t match.');
    if (requireCurrent && !currentPassword) return setFormError('Enter your current password.');
    setFormError(undefined);
    change.mutate({ currentPassword: requireCurrent ? currentPassword : undefined, newPassword });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {requireCurrent && (
        <AuthField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      )}
      <AuthField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters. Other devices will be logged out."
        required
      />
      <AuthField
        label="Repeat new password"
        name="repeat"
        type="password"
        autoComplete="new-password"
        error={formError ?? change.error?.message}
        required
      />
      <Button type="submit" className="h-11 self-start" disabled={change.isPending}>
        {change.isPending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
