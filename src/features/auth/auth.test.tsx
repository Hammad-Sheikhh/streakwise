import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeApi, TEST_EMAIL, TEST_PASSWORD } from '@/test/fakeApi';
import { renderRoutes } from '@/test/renderRoutes';

describe('login (ACCT-3, AUTH-4)', () => {
  it('sends a logged-out visitor from Home to the login page', async () => {
    const { router } = renderRoutes('/', fakeApi());
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows a calm error for wrong details and stays on the login page', async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes('/login', fakeApi());
    await user.type(await screen.findByLabelText('Email'), TEST_EMAIL);
    await user.type(screen.getByLabelText('Password'), 'guess');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('logs in, shows who is logged in, and logs out from Settings', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const { router } = renderRoutes('/login', api);
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeDisabled();
    await user.type(screen.getByLabelText('Email'), TEST_EMAIL);
    await user.type(screen.getByLabelText('Password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(api.loggedIn).toBe(true);

    await router.navigate('/settings');
    expect(await screen.findByText(TEST_EMAIL)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.loggedIn).toBe(false);
  });

  it('explains an expired email link', async () => {
    renderRoutes('/login?link=expired', fakeApi());
    expect(await screen.findByRole('status')).toHaveTextContent('expired or was already used');
  });

  it('offers to resend the confirmation email (ACCT-2)', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.pending.push('new@example.com');
    const resend = vi.spyOn(api.account, 'resendConfirmation');
    renderRoutes('/login', api);
    await user.type(await screen.findByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'whatever1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send the confirmation email again' }),
    );
    expect(resend).toHaveBeenCalledWith({ email: 'new@example.com' });
  });
});

describe('sign-up and passwords (ACCT-1, ACCT-4, ACCT-9)', () => {
  it('checks the form, then asks to confirm the email', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    renderRoutes('/signup', api);
    await user.type(await screen.findByLabelText('Your name'), 'New Student');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(api.pending).toEqual([]);

    await user.type(screen.getByLabelText('Password'), ' and longer');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'We sent a confirmation link to new@example.com',
    );
    expect(api.pending).toEqual(['new@example.com']);
  });

  it('sends a reset link without saying whether the email exists', async () => {
    const user = userEvent.setup();
    renderRoutes('/forgot-password', fakeApi());
    await user.type(await screen.findByLabelText('Email'), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If someone@example.com has an account',
    );
  });

  it('chooses a new password after a reset link, without the old one', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    api.recovering = true;
    const { router } = renderRoutes('/reset-password', api);
    await user.type(await screen.findByLabelText('New password'), 'brand new password');
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Repeat new password'), 'brand new passwrd');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('The two new passwords don’t match.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Repeat new password'));
    await user.type(screen.getByLabelText('Repeat new password'), 'brand new password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(api.password).toBe('brand new password');
  });

  it('says a reset link has expired when not logged in', async () => {
    renderRoutes('/reset-password', fakeApi());
    expect(await screen.findByRole('link', { name: 'Get a new link' })).toBeInTheDocument();
  });

  it('changes the password in Settings with the current one', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    renderRoutes('/settings', api);
    await user.click(await screen.findByRole('button', { name: 'Change password' }));
    await user.type(screen.getByLabelText('Current password'), TEST_PASSWORD);
    await user.type(screen.getByLabelText('New password'), 'brand new password');
    await user.type(screen.getByLabelText('Repeat new password'), 'brand new password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(api.password).toBe('brand new password'));
  });

  it('deletes the account only with the password and DELETE typed', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ loggedIn: true });
    const { router } = renderRoutes('/settings', api);
    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' });
    await user.type(within(dialog).getByLabelText('Your password'), TEST_PASSWORD);
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Type DELETE to confirm'));
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.deleted).toBe(true);
  });
});
