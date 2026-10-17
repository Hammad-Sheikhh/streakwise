import { conflict, DomainError, notFound } from '../../../src/core/domain/errors';

// Turns Postgres errors (as returned by supabase-js) into DomainErrors the API can map to a status.
// Our RPC functions raise SQLSTATE P0001 with a short code as the message, or P0002 for "not found".

interface DbError {
  code?: string;
  message: string;
}

export function toDomainError(error: DbError): Error {
  switch (error.code) {
    case 'P0001':
      return conflict(error.message);
    case 'P0002':
    case 'PGRST116': // PostgREST: `.single()` matched no rows
      return notFound(error.code === 'P0002' ? error.message : 'not_found');
    case '23505':
      return conflict('duplicate');
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
