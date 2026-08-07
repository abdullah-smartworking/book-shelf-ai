import { useCallback, useEffect, useState } from 'react';

import type { Book, CreateUserInput, Review, UpdateUserInput, UserWithStats } from '@bookshelf/shared';

import { ApiError, createUser, getUserActivity, getUserById, getUserRecommendations, updateUser } from '../lib/api';

export interface UseProfileResult {
  profile: UserWithStats | null;
  activity: Review[];
  recommendations: Book[];
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
  const [recommendations, setRecommendations] = useState<Book[]>([]);
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
      setRecommendations([]);
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

    Promise.all([
      getUserById(userId, controller.signal),
      getUserActivity(userId, controller.signal),
      getUserRecommendations(userId, controller.signal),
    ])
      .then(([userResult, activityResult, recommendationsResult]) => {
        if (cancelled) return;
        setProfile(userResult);
        setActivity(activityResult);
        setRecommendations(recommendationsResult);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        if (cause instanceof ApiError && cause.code === 'NOT_FOUND') {
          // No profile for this id yet — the page offers to create one. Not an error.
          setProfile(null);
          setActivity([]);
          setRecommendations([]);
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
        // A new profile's recommendations depend on favouriteGenres just submitted —
        // worth a real fetch rather than assuming empty, unlike activity/stats.
        getUserRecommendations(user.id)
          .then(setRecommendations)
          .catch(() => setRecommendations([]));
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
    recommendations,
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
