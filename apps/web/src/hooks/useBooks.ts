import { useCallback, useEffect, useState } from 'react';

import type { Book, BookSearchHit } from '@bookshelf/shared';

import { ApiError, listBooks, searchBooks } from '../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

/** A book in the catalogue view: either a plain book or a search hit. */
export type CatalogueBook = Book | BookSearchHit;

export interface UseBooksResult {
  books: CatalogueBook[];
  isLoading: boolean;
  error: string | null;
  /** True while showing search results rather than the full catalogue. */
  isSearching: boolean;
  /** The term the current results correspond to — '' when showing everything. */
  activeTerm: string;
  retry: () => void;
}

/**
 * Owns all catalogue data fetching: the full list, and the debounced search that
 * replaces it.
 *
 * Two things here are the difference between "works on my machine" and "works":
 *
 *  1. **AbortController.** Search requests are fired as you type; without aborting,
 *     responses can arrive out of order and a slow request for "du" can overwrite the
 *     results for "dune". Aborting on cleanup makes the last request the only winner.
 *  2. **`nonce`** is what makes Retry work. `useEffect` only re-runs when a dependency
 *     changes, and retrying the *same* term changes nothing — so incrementing a counter
 *     is the standard way to say "run that again".
 */
export function useBooks(searchTerm: string): UseBooksResult {
  const debouncedTerm = useDebouncedValue(searchTerm.trim(), 250);

  const [books, setBooks] = useState<CatalogueBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const request =
      debouncedTerm === ''
        ? listBooks(controller.signal)
        : searchBooks(debouncedTerm, controller.signal);

    request
      .then((result) => {
        if (cancelled) return;
        setBooks(result);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        // A cancelled request is expected while typing — not an error to surface.
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(
          cause instanceof ApiError ? cause.message : 'Something went wrong loading books.',
        );
        setBooks([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedTerm, nonce]);

  return {
    books,
    isLoading,
    error,
    isSearching: debouncedTerm !== '',
    activeTerm: debouncedTerm,
    retry,
  };
}
