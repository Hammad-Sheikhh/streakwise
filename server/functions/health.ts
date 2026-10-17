import pkg from '../../package.json' with { type: 'json' };

// OPS-1: a liveness check that never touches the database.
export function healthHandler(): Response {
  return Response.json(
    { ok: true, version: pkg.version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
