import { describe, expect, it } from 'vitest';

import pkg from '../../package.json' with { type: 'json' };
import health, { config } from './health';

describe('health function', () => {
  it('returns ok with the app version', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, version: pkg.version });
  });

  it('is routed to GET /api/health', () => {
    expect(config.path).toBe('/api/health');
    expect(config.method).toBe('GET');
  });
});
