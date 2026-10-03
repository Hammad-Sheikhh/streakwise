// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/core/domain/errors';
import { toDomainError } from '../functions/_lib/dbErrors';
import { ConfigError, readServerEnv } from '../functions/_lib/env';
import { toErrorResponse } from '../functions/_lib/http';
import { redact } from '../functions/_lib/log';
import { createKeepaliveHandler } from '../functions/keepalive';
import { context, get, testDeps } from './fakes';

describe('readServerEnv', () => {
  it('names missing variables without echoing any values', () => {
    try {
      readServerEnv({ SUPABASE_URL: 'not a url', SESSION_SECRET: 'too-short-secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as Error).message;
      expect(message).toContain('SUPABASE_SECRET_KEY');
      expect(message).toContain('SESSION_SECRET');
      expect(message).not.toContain('too-short-secret-value');
    }
  });
});

describe('redact', () => {
  it('hides sensitive fields and keeps the rest', () => {
    expect(
      redact({
        passcode: 'x',
        note: 'y',
        SUPABASE_SECRET_KEY: 'z',
        cookie: 'c',
        ip: '1.2.3.4',
        seeded: true,
      }),
    ).toEqual({
      passcode: '[redacted]',
      note: '[redacted]',
      SUPABASE_SECRET_KEY: '[redacted]',
      cookie: '[redacted]',
      ip: '[redacted]',
      seeded: true,
    });
  });
});

describe('toDomainError', () => {
  it.each([
    [{ code: 'P0001', message: 'node_in_use' }, 'conflict', 'node_in_use'],
    [{ code: 'P0001', message: 'max_depth' }, 'conflict', 'max_depth'],
    [{ code: 'P0002', message: 'node_not_found' }, 'not_found', 'node_not_found'],
    [{ code: '23505', message: 'duplicate key value' }, 'conflict', 'duplicate'],
    [{ code: '23514', message: 'violates check constraint' }, 'validation', 'invalid'],
  ])('maps %o', (dbError, kind, code) => {
    const error = toDomainError(dbError);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ kind, code });
  });

  it('keeps unknown database errors generic', () => {
    expect(toDomainError({ code: 'XX000', message: 'boom' })).not.toBeInstanceOf(DomainError);
  });
});

describe('toErrorResponse', () => {
  it('maps domain errors to their status', async () => {
    const response = toErrorResponse(
      new DomainError('not_found', 'node_not_found', 'Gone.'),
      'test',
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'node_not_found', message: 'Gone.' } });
  });

  it('hides unexpected errors behind a generic 500 and logs them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = toErrorResponse(new Error('internal detail'), 'test');
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('internal detail');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('GET /api/keepalive (OPS-2)', () => {
  it('pings the database without needing a session', async () => {
    const ping = vi.fn(async () => {});
    const { deps } = testDeps({ ping });
    const response = await createKeepaliveHandler(() => deps)(get('/api/keepalive'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('fails visibly when the database is unreachable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deps } = testDeps({ ping: () => Promise.reject(new Error('down')) });
    const response = await createKeepaliveHandler(() => deps)(get('/api/keepalive'), context);
    expect(response.status).toBe(500);
    spy.mockRestore();
  });
});
