import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { changePasswordInputSchema } from '@/core/schemas/auth';

import { AuthField } from './AuthField';
import { useAccount } from './useAccount';

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [formError, setFormError] = useState<string>();

  const change = useMutation({
    mutationFn: () =>
      account.changePassword({
        currentPassword: requireCurrent ? currentPassword : undefined,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setRepeat('');
      onDone();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = changePasswordInputSchema.shape.newPassword.safeParse(newPassword);
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message);
    if (newPassword !== repeat) return setFormError('The two new passwords don’t match.');
    setFormError(undefined);
    change.mutate();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {requireCurrent && (
        <AuthField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      )}
      <AuthField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters. Other devices will be logged out."
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        required
      />
      <AuthField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(event) => setRepeat(event.target.value)}
        error={formError ?? change.error?.message}
        required
      />
      <Button type="submit" className="h-11 self-start" disabled={change.isPending}>
        {change.isPending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
