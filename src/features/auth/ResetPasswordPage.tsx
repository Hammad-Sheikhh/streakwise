import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { AuthLayout } from './AuthLayout';
import { ChangePasswordForm } from './ChangePasswordForm';
import { useAccount } from './useAccount';

// ACCT-4: where a reset link lands (after /auth/confirm logged the visitor in).
export function ResetPasswordPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['api', 'me'], queryFn: () => account.me(), retry: false });

  if (me.isPending) {
    return (
      <p role="status" className="p-6 text-center text-muted-foreground">
        Loading…
      </p>
    );
  }

  if (me.isError) {
    return (
      <AuthLayout description="Choose a new password.">
        <p role="status">This reset link has expired. Please ask for a new one.</p>
        <Button asChild className="h-11">
          <Link to="/forgot-password">Get a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  // Already logged in without a reset link: the password can be changed in Settings instead.
  if (!me.data.recovering) return <Navigate to="/settings" replace />;

  return (
    <AuthLayout description="Choose a new password.">
      <ChangePasswordForm
        requireCurrent={false}
        onDone={() => {
          toast.success('Password changed.');
          // No reload of `me` here: it would no longer say "recovering" and redirect to Settings.
          void navigate('/', { replace: true });
        }}
      />
    </AuthLayout>
  );
}
