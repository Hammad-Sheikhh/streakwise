import type { Config } from '@netlify/functions';

import pkg from '../../package.json' with { type: 'json' };

// OPS-1: a liveness check that never touches the database.
export default async function health(): Promise<Response> {
  return Response.json(
    { ok: true, version: pkg.version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const config: Config = {
  path: '/api/health',
  method: 'GET',
};
