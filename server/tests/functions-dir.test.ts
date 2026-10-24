// @vitest-environment node
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Vercel deploys every source file under api/ as its own function, and the entry point must stay
// one dispatcher (OPS-4): route code lives in server/functions and is imported there, so `api/`
// is only allowed to contain server.ts. Tests and helpers live elsewhere.
const apiDir = path.resolve(process.cwd(), 'api');

describe('api folder', () => {
  it('contains only api/server.ts so exactly one function deploys', () => {
    const files = readdirSync(apiDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    expect(files).toEqual(['server.ts']);
  });
});
