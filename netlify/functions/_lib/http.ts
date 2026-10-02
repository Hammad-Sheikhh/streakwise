import type { z } from 'zod';

import { DomainError } from '../../../src/core/domain/errors';
import { ConfigError } from './env';
import { describeError, log } from './log';

// SPEC §B8: JSON everywhere, errors shaped `{ error: { code, message } }`.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { ...init.headers, ...NO_STORE },
  });
}

export function errorJson(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

const STATUS_BY_KIND: Record<DomainError['kind'], number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
};

export function toErrorResponse(error: unknown, route: string): Response {
  if (error instanceof HttpError) {
    return errorJson(error.status, error.code, error.message, error.headers);
  }
  if (error instanceof DomainError) {
    return errorJson(STATUS_BY_KIND[error.kind], error.code, error.message);
  }
  if (error instanceof ConfigError) {
    log.error('config_invalid', { route, variables: error.variables });
  } else {
    log.error('unexpected_error', { route, ...describeError(error) });
  }
  return errorJson(500, 'internal', 'Something went wrong. Please try again.');
}

/** Parses a JSON body with a Zod schema; any problem becomes a 400 with a readable message. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid input.';
    throw new HttpError(400, 'validation', message);
  }
  return result.data;
}
