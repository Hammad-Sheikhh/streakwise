// @vitest-environment node
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Netlify deploys every top-level file in netlify/functions as a function, and function names may
// only contain letters, digits, hyphens, and underscores. Tests and helpers must live elsewhere
// (tests in netlify/tests, helpers in netlify/functions/_lib).
const functionsDir = path.resolve(process.cwd(), 'netlify/functions');

describe('netlify/functions folder', () => {
  it('contains only deployable function files at the top level', () => {
    const files = readdirSync(functionsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    expect(files.length).toBeGreaterThan(0);
    const invalid = files.filter((name) => !/^[A-Za-z0-9_-]+\.m?ts$/.test(name));
    expect(invalid).toEqual([]);
  });
});
