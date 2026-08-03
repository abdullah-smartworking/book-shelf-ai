import type { ApiErrorCode } from '@bookshelf/shared';

/**
 * Base class for errors we *intend* to send to the client.
 *
 * The distinction matters: anything that is an `AppError` is a known, expected
 * failure and its message is safe to expose. Anything else that reaches the error
 * handler is a bug, gets logged, and is reported to the client as a generic 500 so
 * we never leak stack traces or file paths.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    // Keeps `instanceof` working when targeting ES2022 classes.
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
