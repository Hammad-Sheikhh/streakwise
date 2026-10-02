import { DomainError } from '../../../src/core/domain/errors';

// Turns Postgres errors (as returned by supabase-js) into DomainErrors the API can map to a status.
// Our RPC functions raise SQLSTATE P0001 with a short code as the message, or P0002 for "not found".

interface DbError {
  code?: string;
  message: string;
}

const MESSAGES: Record<string, string> = {
  max_depth: 'Topics can’t have children: the structure is at most 3 levels deep.',
  node_in_use: 'This has history (sessions, tasks, scores, or deadlines). Archive it instead.',
  node_has_children: 'Move or remove its children first.',
  already_completed: 'This task is already completed for that period.',
};

export function toDomainError(error: DbError): Error {
  switch (error.code) {
    case 'P0001':
      return new DomainError(
        'conflict',
        error.message,
        MESSAGES[error.message] ?? 'That change isn’t allowed.',
      );
    case 'P0002':
      return new DomainError('not_found', error.message, 'That item no longer exists.');
    case '23505':
      return new DomainError(
        'conflict',
        'duplicate',
        'Something with that name already exists here.',
      );
    case '23503':
      return new DomainError('conflict', 'in_use', 'That item is still in use.');
    case '23514':
    case '22P02':
      return new DomainError('validation', 'invalid', 'Some values aren’t valid.');
    default:
      // Unknown database errors stay generic; the message never reaches the client.
      return new Error(`Database error ${error.code ?? 'unknown'}: ${error.message}`);
  }
}

export function throwDbError(error: DbError): never {
  throw toDomainError(error);
}
