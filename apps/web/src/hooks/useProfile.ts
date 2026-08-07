import { useCallback, useEffect, useState } from 'react';

import type { CreateUserInput, Review, UpdateUserInput, UserWithStats } from '@bookshelf/shared';

import { ApiError, createUser, getUserActivity, getUserById, updateUser } from '../lib/api';

export interface UseProfileResult {
  profile: UserWithStats | null;
  activity: Review[];
  isLoading: boolean;
  /** `true` once loading has finished and no profile exists for this id — not an error. */
  notFound: boolean;
  error: string | null;
  retry: () => void;
  createProfile: (input: CreateUserInput) => Promise<void>;
  editProfile: (input: UpdateUserInput) => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
}

/** Same AbortController/cancelled/nonce shape as `useBookDetail`/`useListDetail`. */
export function useProfile(userId: string): UseProfileResult {
  const [profile, setProfile] = useState<UserWithStats | null>(null);
  const [activity, setActivity] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (userId.trim() === '') {
      setProfile(null);
      setActivity([]);
      setIsLoading(false);
      setNotFound(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    Promise.all([getUserById(userId, controller.signal), getUserActivity(userId, controller.signal)])
      .then(([userResult, activityResult]) => {
        if (cancelled) return;
        setProfile(userResult);
        setActivity(activityResult);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        if (cause instanceof ApiError && cause.code === 'NOT_FOUND') {
          // No profile for this id yet — the page offers to create one. Not an error.
          setProfile(null);
          setActivity([]);
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        setError(cause instanceof ApiError ? cause.message : 'Something went wrong loading this profile.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, nonce]);

  const createProfile = useCallback(
    async (input: CreateUserInput) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const user = await createUser(input);
        // A brand-new profile genuinely has zero reviews — no second request needed.
        setProfile({ ...user, stats: { reviewCount: 0, averageRatingGiven: null } });
        setActivity([]);
        setNotFound(false);
      } catch (cause) {
        setSaveError(cause instanceof ApiError ? cause.message : 'Could not create the profile.');
        throw cause;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const editProfile = useCallback(
    async (input: UpdateUserInput) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const updated = await updateUser(userId, input);
        // updateUser returns a bare User, no stats — keep the stats already held,
        // an edit to displayName/avatarUrl/favouriteGenres never changes them.
        setProfile((current) => (current === null ? current : { ...current, ...updated }));
      } catch (cause) {
        setSaveError(cause instanceof ApiError ? cause.message : 'Could not save changes.');
        throw cause;
      } finally {
        setIsSaving(false);
      }
    },
    [userId],
  );

  return {
    profile,
    activity,
    isLoading,
    notFound,
    error,
    retry,
    createProfile,
    editProfile,
    isSaving,
    saveError,
  };
}
