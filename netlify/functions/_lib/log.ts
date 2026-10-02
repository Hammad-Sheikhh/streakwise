// OPS-3: structured JSON logs. Field values whose names suggest secrets or personal text are
// replaced, so a careless call can't leak a passcode, key, cookie, or note into the logs.

type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const SENSITIVE_FIELD = /pass|secret|key|token|cookie|authorization|note|ip$/i;

export function redact(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      SENSITIVE_FIELD.test(name) ? '[redacted]' : value,
    ]),
  );
}

function write(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...redact(fields) });
  console[level](line);
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
};

/** Error details that are safe to log: the type and message, never request data. */
export function describeError(error: unknown): Fields {
  return error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: typeof error };
}
