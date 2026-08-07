import { useState } from 'react';

import { ErrorState } from '../components/states';
import { ProfileForm } from '../components/ProfileForm';
import { useProfile } from '../hooks/useProfile';

/**
 * There's no user directory or auth in this app (see CLAUDE.md's Known
 * Limitations — userId is a free-typed string everywhere, same as reviews).
 * So the entry point here is a userId field, not a list to pick from — the
 * same pattern reviews already use, just made explicit as its own page.
 */
export function ProfilePage(): React.JSX.Element {
  const [userIdInput, setUserIdInput] = useState('');
  const [activeUserId, setActiveUserId] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const {
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
  } = useProfile(activeUserId);

  function handleLoad(event: React.FormEvent): void {
    event.preventDefault();
    setIsEditing(false);
    setActiveUserId(userIdInput.trim());
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Profile</h1>
      <p className="mt-1 text-sm text-muted">Look up a profile by user id.</p>

      <form onSubmit={handleLoad} className="mt-4 flex gap-2">
        <input
          type="text"
          value={userIdInput}
          onChange={(event) => setUserIdInput(event.target.value)}
          placeholder="e.g. user_001"
          aria-label="User id"
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white
                     transition-opacity hover:opacity-90"
        >
          Load
        </button>
      </form>

      {activeUserId === '' ? null : error !== null ? (
        <div className="mt-6">
          <ErrorState title="Could not load this profile" message={error} onRetry={retry} />
        </div>
      ) : isLoading ? (
        <p aria-busy="true" className="mt-6 text-sm text-muted">
          Loading…
        </p>
      ) : notFound ? (
        <div className="mt-6">
          <p className="mb-3 text-sm text-muted">
            No profile exists for “{activeUserId}” yet.
          </p>
          <ProfileForm mode="create" onSubmit={createProfile} isSubmitting={isSaving} submitError={saveError} />
        </div>
      ) : profile !== null ? (
        <div className="mt-6">
          {isEditing ? (
            <ProfileForm
              mode="edit"
              initial={{
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl ?? '',
                favouriteGenres: profile.favouriteGenres,
              }}
              onSubmit={async (input) => {
                await editProfile(input);
                setIsEditing(false);
              }}
              isSubmitting={isSaving}
              submitError={saveError}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-ink">{profile.displayName}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {profile.stats.reviewCount} review{profile.stats.reviewCount === 1 ? '' : 's'}
                    {profile.stats.averageRatingGiven !== null &&
                      ` · ${profile.stats.averageRatingGiven.toFixed(1)} average rating given`}
                  </p>
                  {profile.favouriteGenres.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.favouriteGenres.map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.65rem] font-semibold
                                     uppercase tracking-wider text-accent"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-muted transition-colors hover:text-accent"
                >
                  Edit
                </button>
              </div>

              <section className="mt-8">
                <h3 className="font-serif text-lg font-semibold text-ink">Recent activity</h3>
                {activity.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No reviews yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {activity.map((review) => (
                      <li key={review.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                        <span className="font-medium text-ink">{review.rating}/5</span>{' '}
                        <span className="text-ink/90">{review.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {recommendations.length > 0 && (
                <section className="mt-8">
                  <h3 className="font-serif text-lg font-semibold text-ink">Recommended for you</h3>
                  <ul className="mt-3 space-y-2">
                    {recommendations.map((book) => (
                      <li key={book.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                        <span className="font-medium text-ink">{book.title}</span>{' '}
                        <span className="text-muted">by {book.author}</span>
                        <span
                          className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold
                                     uppercase tracking-wider text-accent"
                        >
                          {book.genre}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
