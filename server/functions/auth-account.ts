import { deleteAccountInputSchema } from '../../src/core/schemas/auth';
import { checkPassword } from './_lib/accountFlow';
import { apiHandler } from './_lib/api';
import { clearCookie, RECOVERY_COOKIE, SESSION_COOKIE } from './_lib/auth';
import type { ServerDeps } from './_lib/deps';
import { json, readJson } from './_lib/http';
import { log } from './_lib/log';

// ACCT-9: deletes the account and, through the database's cascades, all of its data.
export function createAccountHandler(getDeps: () => ServerDeps) {
  return apiHandler({ route: 'auth/account', auth: true }, getDeps, async (input) => {
    const { password } = await readJson(input.request, deleteAccountInputSchema);
    await checkPassword(input, password);
    await input.deps.auth.deleteUser(input.deps.userId);
    log.info('account_deleted', {});
    return json(
      { authenticated: false },
      { cookies: [clearCookie(SESSION_COOKIE), clearCookie(RECOVERY_COOKIE)] },
    );
  });
}
