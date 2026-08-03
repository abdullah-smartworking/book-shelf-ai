import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { ApiErrorResponse } from '@bookshelf/shared';

import { isProduction } from '../config';
import { AppError } from '../errors';

/**
 * Catch-all for requests that matched no route. Registered *after* all routers, so
 * reaching it means nothing else claimed the URL.
 *
 * Without this, Express sends its own HTML 404 page — which breaks any client that
 * assumes every response from `/api/*` is JSON.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorResponse = {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  };
  res.status(404).json(body);
};

/** Errors thrown by `express.json()` when the body is unparseable or too large. */
interface BodyParserError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
}

/**
 * The single place where an error becomes an HTTP response.
 *
 * Two things about this function are easy to get wrong and worth calling out:
 *
 *  1. **It must take exactly four parameters.** Express identifies error-handling
 *     middleware by `fn.length === 4`. Drop the unused `next` and Express silently
 *     treats it as ordinary middleware: thrown errors bypass it entirely and the
 *     request hangs or returns Express's default HTML error page. `_next` is unused
 *     but load-bearing.
 *
 *  2. **It must be registered last**, after every route and after `notFoundHandler`.
 *     Middleware order in Express is execution order.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Errors we raised on purpose: the message is safe to show the caller.
  if (error instanceof AppError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined && { details: error.details }),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  const parserError = error as BodyParserError;

  if (parserError.type === 'entity.too.large') {
    const body: ApiErrorResponse = {
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    };
    res.status(413).json(body);
    return;
  }

  // `express.json()` throws a SyntaxError with a `body` property for malformed JSON.
  // Left unhandled this surfaces as a confusing 500 for what is a client mistake.
  if (parserError instanceof SyntaxError && 'body' in parserError) {
    const body: ApiErrorResponse = {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body could not be parsed as JSON',
        ...(isProduction ? {} : { details: parserError.message }),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Anything reaching here is an unexpected bug. Log it in full for us; tell the
  // client almost nothing, so stack traces and paths are not leaked.
  console.error('[api] unhandled error:', error);

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(isProduction ? {} : { details: error instanceof Error ? error.message : String(error) }),
    },
  };
  res.status(500).json(body);
};
