import { describe, expect, it } from 'vitest';

import pkg from '../../package.json' with { type: 'json' };
import { healthHandler } from '../functions/health.js';

describe('health handler', () => {
  it('returns ok with the app version', async () => {
    const response = healthHandler();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, version: pkg.version });
  });
});
