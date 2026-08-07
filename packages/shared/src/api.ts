import type { Book } from './book';
import type { Review } from './review';

/**
 * Every successful response is wrapped in `{ data: ... }` and every failure in
 * `{ error: { code, message } }`.
 *
 * Why an envelope? A bare array (`[...]`) leaves nowhere to put pagination info
 * later without breaking every client, and it makes "is this a success or an
 * error?" a matter of guessing the shape. One consistent envelope means the
 * Day 2 frontend can write a single `fetchJson()` helper.
 */
export interface PaginationMeta {
  /** Total records matching the filters, before pagination. */
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

/** Machine-readable error codes. Clients should branch on `code`, never on `message`. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode | string;
    message: string;
    /** Field-level validation issues, or debug info outside production. */
    details?: unknown;
  };
}

/**
 * `GET /api/books/:id` returns the book with its reviews embedded, plus the
 * average of those ratings. `null` (not `0`) when there are no reviews yet —
 * a book with zero reviews has no average, it doesn't have a 0-star average.
 */
export interface BookWithReviews extends Book {
  reviews: Review[];
  averageRating: number | null;
}

/** A single hit from `GET /api/books/search`, with the field that matched. */
export interface BookSearchHit extends Book {
  matchedOn: Array<'title' | 'author' | 'genre' | 'description'>;
}

export interface SearchMeta {
  query: string;
  total: number;
  limit: number;
}

export interface ApiSearchResponse {
  data: BookSearchHit[];
  meta: SearchMeta;
}
