// Errors that services and repositories raise. The API maps `kind` to an HTTP status and the UI
// shows `message`, so messages must be safe to display and never include secrets or note text.

export type DomainErrorKind = 'validation' | 'not_found' | 'conflict';

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  /** A stable machine-readable code, e.g. `node_in_use`. */
  readonly code: string;
  /** Extra facts for Claude, e.g. which batch item failed (MCP-20); safe to show. */
  readonly details: Record<string, string | number> | undefined;

  constructor(
    kind: DomainErrorKind,
    code: string,
    message: string,
    details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = 'DomainError';
    this.kind = kind;
    this.code = code;
    this.details = details;
  }
}

// Shared by both repositories, so the demo and the real app word conflicts the same way.
export const CONFLICT_MESSAGES: Record<string, string> = {
  max_depth: 'Topics can’t have children: the structure is at most 3 levels deep.',
  node_in_use: 'This has history (sessions, tasks, scores, or deadlines). Archive it instead.',
  node_has_children: 'Move or remove its children first.',
  already_completed: 'This task is already completed for that period.',
  duplicate: 'Something with that name already exists here.',
  not_completed: 'This task isn’t completed for that period.',
  already_undone: 'This change was already undone.',
  changed_since: 'This was changed again afterwards. Undo the later change first.',
  cannot_undo: 'This can’t be undone any more: something it depends on has changed.',
  mistake_learned: 'This mistake is already learned.',
};

export function conflict(code: string): DomainError {
  return new DomainError('conflict', code, CONFLICT_MESSAGES[code] ?? 'That change isn’t allowed.');
}

export function notFound(code: string): DomainError {
  return new DomainError('not_found', code, 'That item no longer exists.');
}

export function invalid(code: string, message: string): DomainError {
  return new DomainError('validation', code, message);
}
