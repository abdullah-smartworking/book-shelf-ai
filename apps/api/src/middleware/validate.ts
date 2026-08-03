import type { TypeOf, ZodError, ZodTypeAny } from 'zod';

import { ValidationError } from '../errors';

/**
 * Runs a Zod schema and either returns the parsed value or throws a
 * `ValidationError` that the central error handler turns into a 400.
 *
 * `safeParse` is used rather than `parse` so the raw `ZodError` never escapes this
 * module — the API's error contract stays ours, not Zod's.
 *
 * The return type is `TypeOf<S>`, i.e. the schema's *output* type. That matters:
 * after parsing, `.default()`ed fields are guaranteed present and coerced fields are
 * real numbers, so downstream code has no optional-chaining noise.
 */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): TypeOf<S> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError('Request validation failed', formatIssues(result.error));
  }

  return result.data;
}

export interface FieldIssue {
  /** Dotted path to the offending field, e.g. `year` or `authors.0.name`. */
  field: string;
  message: string;
  code: string;
}

function formatIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
    code: issue.code,
  }));
}
