import { useCallback, useEffect, useState } from 'react';

import type { CreateListInput, List } from '@bookshelf/shared';

import { ApiError, createList, deleteList, listLists } from '../lib/api';

export interface UseListsResult {
  lists: List[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  addList: (input: CreateListInput) => Promise<void>;
  isCreating: boolean;
  createError: string | null;
  removeList: (id: string) => Promise<void>;
}

/** Same AbortController/cancelled/nonce shape as `useBooks` — the house pattern. */
export function useLists(): UseListsResult {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    listLists(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setLists(result);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(
          cause instanceof ApiError ? cause.message : 'Something went wrong loading reading lists.',
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  const addList = useCallback(async (input: CreateListInput) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createList(input);
      // Append rather than refetch — the just-created list is the only new thing.
      setLists((current) => [...current, created]);
    } catch (cause) {
      setCreateError(cause instanceof ApiError ? cause.message : 'Could not create the list.');
      throw cause;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const removeList = useCallback(async (id: string) => {
    await deleteList(id);
    setLists((current) => current.filter((list) => list.id !== id));
  }, []);

  return { lists, isLoading, error, retry, addList, isCreating, createError, removeList };
}
