// Vercel runs Node functions unbundled with "type": "module", where Node's ESM loader requires
// explicit ".js" extensions on every relative import. The whole server tree imports bare
// './module' specifiers (fine for Vite/tsc), so instead of rewriting every import we bundle the
// entire function into ONE self-contained file that only imports Node builtins. esbuild reads the
// TS source, bundles it, and writes the result over the same file — but only inside the Vercel
// build container (this script is part of the `build` command); the committed source never changes.
// Docs checked 2026-10-24: https://vercel.com/docs/functions/runtimes/node-js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const entryUrl = new URL('../api/server.ts', import.meta.url);
const entry = fileURLToPath(entryUrl);
const resolveDir = path.dirname(entry);

const source = readFileSync(entryUrl, 'utf8');

await build({
  stdin: { contents: source, sourcefile: 'server.ts', loader: 'ts', resolveDir },
  allowOverwrite: true,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  legalComments: 'none',
  outfile: entry,
});

console.log('api/server.ts bundled in place (function-only build step)');
