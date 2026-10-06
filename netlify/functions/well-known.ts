import type { Config } from '@netlify/functions';

// Claude checks /.well-known/oauth-* (and similar) before connecting to the MCP server, to find out
// how it signs in. Without this function the SPA fallback answers 200 with the app's HTML, which
// makes Claude treat Streakwise as needing OAuth, so the connector never connects. The MCP server
// has no sign-in (the secret URL is the credential), so every well-known path is a plain 404.
export default async function wellKnown(): Promise<Response> {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const config: Config = {
  path: '/.well-known/*',
};
