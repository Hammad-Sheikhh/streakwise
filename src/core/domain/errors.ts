// Errors that services and repositories raise. The API maps `kind` to an HTTP status and the UI
// shows `message`, so messages must be safe to display and never include secrets or note text.

export type DomainErrorKind = 'validation' | 'not_found' | 'conflict';

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  /** A stable machine-readable code, e.g. `node_in_use`. */
  readonly code: string;

  constructor(kind: DomainErrorKind, code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.kind = kind;
    this.code = code;
  }
}
