import { useCallback, useEffect, useState } from 'react';

import type { ListWithBooks } from '@bookshelf/shared';

import { ApiError, getListById, updateListBooks } from '../lib/api';

export interface UseListDetailResult {
  list: ListWithBooks | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  removeBook: (bookId: string) => Promise<void>;
  isMutating: boolean;
  mutateError: string | null;
}

/** Same AbortController/cancelled/nonce shape as `useBookDetail` — the house pattern. */
export function useListDetail(listId: string): UseListDetailResult {
  const [list, setList] = useState<ListWithBooks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [isMutating, setIsMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getListById(listId, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setList(result);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(cause instanceof ApiError ? cause.message : 'Something went wrong loading this list.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [listId, nonce]);

  const removeBook = useCallback(
    async (bookId: string) => {
      setIsMutating(true);
      setMutateError(null);
      try {
        const updated = await updateListBooks(listId, { remove: [bookId] });
        // The PUT response is a bare List (bookIds only, no resolved books). Rather
        // than refetch, take its bookIds as the new source of truth and drop the
        // matching entry from the already-resolved `books` array locally — same
        // "patch don't refetch" reasoning as useBookDetail's review-prepend.
        setList((current) =>
          current === null
            ? current
            : {
                ...current,
                bookIds: updated.bookIds,
                books: current.books.filter((book) => book.id !== bookId),
              },
        );
      } catch (cause) {
        setMutateError(cause instanceof ApiError ? cause.message : 'Could not remove that book.');
        throw cause;
      } finally {
        setIsMutating(false);
      }
    },
    [listId],
  );

  return { list, isLoading, error, retry, removeBook, isMutating, mutateError };
}
