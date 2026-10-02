import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDataSource } from '@/data/useDataSource';

// AUTH-1: passcode login plus a way into the demo.
export function LoginPage() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const errorId = useId();

  const login = useMutation({
    mutationFn: (value: string) => dataSource.login(value),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      void navigate('/', { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passcode.length > 0) login.mutate(passcode);
  }

  const error = login.error?.message;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">Streakwise</h1>
          </CardTitle>
          <CardDescription>Enter your passcode to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                type="password"
                autoComplete="current-password"
                className="h-11"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                required
                autoFocus
              />
              {error && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-11"
              disabled={login.isPending || passcode.length === 0}
            >
              {login.isPending ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
          <div className="flex flex-col gap-2 border-t pt-6 text-center">
            <p className="text-sm text-muted-foreground">Just looking around?</p>
            <Button asChild variant="outline" className="h-11">
              <Link to="/demo">Try the demo</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
