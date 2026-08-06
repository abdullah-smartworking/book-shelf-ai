import type {
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  ApiSearchResponse,
  Book,
  BookSearchHit,
  BookWithReviews,
  CreateReviewInput,
  Review,
} from '@bookshelf/shared';

/**
 * The single place in the frontend that talks HTTP.
 *
 * URLs are relative (`/api/...`) and reach the API through the Vite dev-server proxy
 * configured in `vite.config.ts` — so no origin is baked into the bundle and there is
 * no CORS setup on the Express side.
 */

/** An API failure with the server's own error code preserved. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Because the API answers with one consistent envelope, unwrapping it is one helper
 * rather than per-call error handling. A non-2xx response is parsed for
 * `{ error: { code, message } }` and rethrown as an `ApiError`, so callers branch on
 * `code` and never have to inspect status codes or response bodies themselves.
 */
interface FetchJsonOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

async function fetchJson<T>(path: string, options: FetchJsonOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // An aborted request is a normal part of debounced search, not a failure to report.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the API. Is it running?');
  }

  if (!response.ok) {
    // Even the error path must not throw on a non-JSON body (a proxy 502, say).
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `Request failed with status ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function listBooks(signal?: AbortSignal): Promise<Book[]> {
  const { data } = await fetchJson<ApiListResponse<Book>>('/api/books?limit=100', { signal });
  return data;
}

export async function searchBooks(term: string, signal?: AbortSignal): Promise<BookSearchHit[]> {
  // encodeURIComponent matters: an unescaped '&' or '#' in the term would silently
  // truncate the query, and '+' would arrive as a space.
  const { data } = await fetchJson<ApiSearchResponse>(
    `/api/books/search?q=${encodeURIComponent(term)}&limit=100`,
    { signal },
  );
  return data;
}

export async function getBookById(id: string, signal?: AbortSignal): Promise<BookWithReviews> {
  const { data } = await fetchJson<ApiItemResponse<BookWithReviews>>(
    `/api/books/${encodeURIComponent(id)}`,
    { signal },
  );
  return data;
}

export async function createReview(
  bookId: string,
  input: CreateReviewInput,
  signal?: AbortSignal,
): Promise<Review> {
  const { data } = await fetchJson<ApiItemResponse<Review>>(
    `/api/books/${encodeURIComponent(bookId)}/reviews`,
    { method: 'POST', body: input, signal },
  );
  return data;
}
