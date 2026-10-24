import { deleteAccountInputSchema } from '../../src/core/schemas/auth.js';
import { checkPassword } from './_lib/accountFlow.js';
import { apiHandler } from './_lib/api.js';
import { clearCookie, RECOVERY_COOKIE, SESSION_COOKIE } from './_lib/auth.js';
import type { ServerDeps } from './_lib/deps.js';
import { json, readJson } from './_lib/http.js';
import { log } from './_lib/log.js';

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
