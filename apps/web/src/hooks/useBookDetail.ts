import { useCallback, useEffect, useState } from 'react';

import type { BookWithReviews, CreateReviewInput } from '@bookshelf/shared';

import { ApiError, createReview, getBookById } from '../lib/api';

/**
 * Mirrors `computeAverageRating` in apps/api/src/services/books.service.ts.
 * Small and pure enough that duplicating it beats introducing a shared-logic
 * export from @bookshelf/shared for one four-line function — but if this
 * drifts from the server's version, the average shown here goes wrong.
 */
function computeAverageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

export interface UseBookDetailResult {
  book: BookWithReviews | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  submitReview: (input: CreateReviewInput) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Same AbortController/cancelled/nonce shape as `useBooks` — the house pattern
 * for data fetching in this app.
 */
export function useBookDetail(bookId: string): UseBookDetailResult {
  const [book, setBook] = useState<BookWithReviews | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getBookById(bookId, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setBook(result);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError(cause instanceof ApiError ? cause.message : 'Something went wrong loading this book.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bookId, nonce]);

  const submitReview = useCallback(
    async (input: CreateReviewInput) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const review = await createReview(bookId, input);
        // Prepend rather than refetch: findByBookId sorts newest-first by
        // createdAt, and the just-created review is always the newest. The
        // average must be recomputed here too — otherwise it goes stale until
        // the next fetch, silently showing a rating that ignores this review.
        setBook((current) => {
          if (current === null) return current;
          const reviews = [review, ...current.reviews];
          return {
            ...current,
            reviews,
            averageRating: computeAverageRating(reviews.map((r) => r.rating)),
          };
        });
      } catch (cause) {
        setSubmitError(cause instanceof ApiError ? cause.message : 'Could not submit the review.');
        throw cause;
      } finally {
        setIsSubmitting(false);
      }
    },
    [bookId],
  );

  return { book, isLoading, error, retry, submitReview, isSubmitting, submitError };
}
