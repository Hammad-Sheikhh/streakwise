import type { AccountApi } from '@/data/AccountApi';
import { useDataSource } from '@/data/useDataSource';

/** The account API. Account pages are only mounted for the real app, never in demo mode. */
export function useAccount(): AccountApi {
  const { account } = useDataSource();
  if (!account) throw new Error('Accounts are not available in demo mode');
  return account;
}
