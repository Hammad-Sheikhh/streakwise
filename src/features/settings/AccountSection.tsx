import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataSource } from '@/data/useDataSource';
import { AuthField } from '@/features/auth/AuthField';
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm';
import type { AccountApi } from '@/data/AccountApi';

// AUTH-4, ACCT-9: who is logged in, log out, change password, delete account. Exit in the demo.
export function AccountSection() {
  const dataSource = useDataSource();
  const navigate = useNavigate();

  return (
    <section aria-labelledby="account-heading" className="flex flex-col items-start gap-4">
      <h2 id="account-heading" className="text-lg font-medium">
        Account
      </h2>
      {dataSource.account ? (
        <AccountDetails account={dataSource.account} />
      ) : (
        <Button variant="outline" className="h-11" onClick={() => void navigate('/login')}>
          Exit demo
        </Button>
      )}
    </section>
  );
}

function AccountDetails({ account }: { account: AccountApi }) {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['api', 'me'], queryFn: () => account.me() });
  const [changing, setChanging] = useState(false);

  const logout = useMutation({
    mutationFn: () => dataSource.logout(),
    onSuccess: () => {
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      {me.data?.user && (
        <p className="text-sm">
          Logged in as <strong>{me.data.user.email}</strong>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Log out
        </Button>
        {!changing && (
          <Button variant="outline" className="h-11" onClick={() => setChanging(true)}>
            Change password
          </Button>
        )}
        <DeleteAccount account={account} />
      </div>
      {changing && (
        <div className="w-full max-w-sm rounded-lg border p-4">
          <ChangePasswordForm
            requireCurrent
            onDone={() => {
              setChanging(false);
              toast.success('Password changed. Other devices have been logged out.');
            }}
          />
        </div>
      )}
    </>
  );
}

function DeleteAccount({ account }: { account: AccountApi }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const remove = useMutation({
    mutationFn: () => account.deleteAccount({ password, confirm: 'DELETE' }),
    onSuccess: () => {
      queryClient.clear();
      toast.success('Your account and all its data were deleted.');
      void navigate('/login', { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    remove.mutate();
  }

  return (
    <>
      <Button variant="destructive" className="h-11" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPassword('');
            setConfirm('');
            remove.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all your tracks, sessions, tasks, scores,
              and deadlines. It can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <AuthField
              label="Your password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <AuthField
              label="Type DELETE to confirm"
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={remove.error?.message}
              required
            />
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                className="h-11"
                disabled={remove.isPending || password === '' || confirm !== 'DELETE'}
              >
                {remove.isPending ? 'Deleting…' : 'Delete everything'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
