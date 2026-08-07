import { useState } from 'react';

import type { CreateUserInput, UpdateUserInput } from '@bookshelf/shared';
import { createUserSchema, updateUserSchema } from '@bookshelf/shared';

/**
 * The real genre names in this catalogue (via the bookshelf MCP server's
 * get_book_stats tool, not guessed) — offering only genres that actually exist
 * in data/books.json, rather than a hand-typed list that could drift from it.
 */
const KNOWN_GENRES = [
  'Technology',
  'Science Fiction',
  'Fantasy',
  'Fiction',
  'Mystery',
  'History',
  'Non-Fiction',
  'Biography',
  'Philosophy',
  'Business',
];

interface ProfileFormValues {
  displayName: string;
  avatarUrl: string;
  favouriteGenres: string[];
}

/**
 * A discriminated union, not a single `mode: 'create' | 'edit'` field with a
 * shared `onSubmit: (input: CreateUserInput | UpdateUserInput) => ...` — that
 * looser shape doesn't compile against either real caller: `createProfile`
 * only accepts `CreateUserInput`, `editProfile` only accepts `UpdateUserInput`,
 * and neither should be widened just to satisfy this component's prop type.
 */
type ProfileFormProps =
  | {
      mode: 'create';
      initial?: undefined;
      onSubmit: (input: CreateUserInput) => Promise<void>;
      isSubmitting: boolean;
      submitError: string | null;
    }
  | {
      mode: 'edit';
      initial: ProfileFormValues;
      onSubmit: (input: UpdateUserInput) => Promise<void>;
      isSubmitting: boolean;
      submitError: string | null;
    };

export function ProfileForm(props: ProfileFormProps): React.JSX.Element {
  const { mode, initial, isSubmitting, submitError } = props;
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? '');
  const [favouriteGenres, setFavouriteGenres] = useState<string[]>(initial?.favouriteGenres ?? []);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function toggleGenre(genre: string): void {
    setFavouriteGenres((current) =>
      current.includes(genre) ? current.filter((g) => g !== genre) : [...current, genre],
    );
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const candidate = {
      displayName: mode === 'create' || displayName.trim() !== '' ? displayName : undefined,
      avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl,
      favouriteGenres,
    };

    // Same schemas the server validates with — a rejection here is guaranteed
    // to also be rejected there, same pattern as ReviewForm/CreateListForm.
    // Branching on `props.mode` (not the destructured `mode`) is what lets
    // TypeScript narrow `props.onSubmit` to the matching parameter type below.
    if (props.mode === 'create') {
      const result = createUserSchema.safeParse(candidate);
      if (!result.success) {
        setFieldError(result.error.issues[0]?.message ?? 'Invalid input');
        return;
      }
      setFieldError(null);
      try {
        await props.onSubmit(result.data);
      } catch {
        return;
      }
    } else {
      const result = updateUserSchema.safeParse(candidate);
      if (!result.success) {
        setFieldError(result.error.issues[0]?.message ?? 'Invalid input');
        return;
      }
      setFieldError(null);
      try {
        await props.onSubmit(result.data);
      } catch {
        // submitError (from the hook) already carries the message; fields are left
        // as-is so the user doesn't have to retype anything, same as ReviewForm.
        return;
      }
    }
  }

  const errorToShow = fieldError ?? submitError;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-serif text-base font-semibold text-ink">
        {mode === 'create' ? 'Create your profile' : 'Edit profile'}
      </h2>

      <div className="mt-3">
        <label htmlFor="profile-display-name" className="text-xs font-medium text-muted">
          Display name
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="profile-avatar-url" className="text-xs font-medium text-muted">
          Avatar URL (optional)
        </label>
        <input
          id="profile-avatar-url"
          type="text"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-muted">Favourite genres</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {KNOWN_GENRES.map((genre) => {
            const selected = favouriteGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selected
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-muted hover:border-accent'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </fieldset>

      {errorToShow !== null && <p className="mt-3 text-xs text-accent">{errorToShow}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white
                   transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create profile' : 'Save changes'}
      </button>
    </form>
  );
}
