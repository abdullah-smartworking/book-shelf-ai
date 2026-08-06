/**
 * The three non-happy-path states, styled rather than left as bare text.
 *
 * They live together because they share the grid geometry with `BookGrid` and are
 * only ever rendered in its place.
 */

/** Matches the real card's padding and rhythm so the layout does not jump on load. */
function SkeletonCard(): React.JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 shimmer">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="h-5 w-20 rounded-full bg-ink/8" />
        <div className="h-3 w-8 rounded bg-ink/8" />
      </div>
      <div className="h-5 w-4/5 rounded bg-ink/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-ink/8" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-ink/8" />
        <div className="h-3 w-11/12 rounded bg-ink/8" />
        <div className="h-3 w-3/5 rounded bg-ink/8" />
      </div>
    </div>
  );
}

export function LoadingGrid(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading books"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4"
    >
      {/* Eight is enough to fill two rows on a wide screen without a visible cut-off. */}
      {Array.from({ length: 8 }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function ErrorState({
  title = 'Could not load the catalogue',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mx-auto max-w-md rounded-xl border border-accent/40 bg-surface p-8 text-center"
    >
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white
                   transition-opacity hover:opacity-90"
      >
        Retry
      </button>
      <p className="mt-4 text-xs text-muted">
        The API should be running on port 3000 — start it with <code>npm run dev</code>.
      </p>
    </div>
  );
}

export function EmptyState({ term }: { term: string }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-serif text-lg font-semibold text-ink">No matches</p>
      <p className="mt-2 text-sm text-muted">
        Nothing in the catalogue matches “{term}”. Try an author surname, or a genre like
        “Fantasy”.
      </p>
    </div>
  );
}
