import { useState } from 'react';

import type { CreateReviewInput } from '@bookshelf/shared';
import { createReviewSchema } from '@bookshelf/shared';

const USER_ID_STORAGE_KEY = 'bookshelf:lastUserId';

/** No auth exists, so this is the only continuity a reviewer gets between visits. */
function readStoredUserId(): string {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ReviewForm({
  onSubmit,
  isSubmitting,
  submitError,
}: {
  onSubmit: (input: CreateReviewInput) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}): React.JSX.Element {
  const [userId, setUserId] = useState(readStoredUserId);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    // The same schema the server validates with — see packages/shared/src/review.ts —
    // so a rejection here is guaranteed to also be rejected there, and vice versa.
    const result = createReviewSchema.safeParse({ userId, rating, text });
    if (!result.success) {
      const issues: Record<string, string> = {};
      for (const issue of result.error.issues) {
        issues[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(issues);
      return;
    }
    setFieldErrors({});

    try {
      await onSubmit(result.data);
    } catch {
      // submitError (from the hook) already carries the message; form fields are
      // deliberately left as-is so the reviewer doesn't have to retype anything.
      return;
    }

    try {
      localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    } catch {
      // Best-effort only — private browsing / storage quota is not worth surfacing.
    }
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-4">
      <h3 className="font-serif text-base font-semibold text-ink">Leave a review</h3>

      <div className="mt-3">
        <label htmlFor="review-user-id" className="text-xs font-medium text-muted">
          Your name or user id
        </label>
        <input
          id="review-user-id"
          type="text"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldErrors.userId && <p className="mt-1 text-xs text-accent">{fieldErrors.userId}</p>}
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted">Rating</legend>
        <div role="radiogroup" aria-label="Rating" className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={`grid size-8 cursor-pointer place-items-center rounded-full border text-sm
                ${
                  rating === value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-muted hover:border-accent'
                }`}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
        {fieldErrors.rating && <p className="mt-1 text-xs text-accent">{fieldErrors.rating}</p>}
      </fieldset>

      <div className="mt-3">
        <label htmlFor="review-text" className="text-xs font-medium text-muted">
          Review
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={4000}
          rows={3}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldErrors.text && <p className="mt-1 text-xs text-accent">{fieldErrors.text}</p>}
      </div>

      {submitError !== null && <p className="mt-3 text-sm text-accent">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white
                   transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
