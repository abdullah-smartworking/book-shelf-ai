import { ReviewCard } from '../components/ReviewCard';
import { ReviewForm } from '../components/ReviewForm';
import { ErrorState } from '../components/states';
import { useBookDetail } from '../hooks/useBookDetail';

/**
 * Owns view selection (loading / error / content), same shape as CataloguePage.
 * A single book doesn't need the grid skeleton from states.tsx — that component's
 * own doc comment ties it to BookGrid's geometry — so loading here is a small,
 * local placeholder instead.
 */
export function BookDetailPage({
  bookId,
  onBack,
}: {
  bookId: string;
  onBack: () => void;
}): React.JSX.Element {
  const { book, isLoading, error, retry, submitReview, isSubmitting, submitError } =
    useBookDetail(bookId);

  return (
    <div className="min-h-dvh">
      <div className="border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            ← Back to catalogue
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error !== null ? (
          <ErrorState title="Could not load this book" message={error} onRetry={retry} />
        ) : isLoading || book === null ? (
          <p aria-busy="true" className="py-16 text-center text-sm text-muted">
            Loading…
          </p>
        ) : (
          <>
            <span
              className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.65rem] font-semibold
                         uppercase tracking-wider text-accent"
            >
              {book.genre}
            </span>

            <h1 className="mt-3 font-serif text-2xl font-semibold leading-snug text-ink sm:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {book.author} · {book.year}
            </p>

            {book.description !== '' && (
              <p className="mt-4 text-sm leading-relaxed text-ink/90">{book.description}</p>
            )}

            {book.isbn !== null && (
              <p className="mt-3 font-mono text-xs text-muted/70">{book.isbn}</p>
            )}

            <section className="mt-8">
              <h2 className="font-serif text-lg font-semibold text-ink">
                Reviews ({book.reviews.length})
              </h2>

              {book.reviews.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No reviews yet — be the first.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {book.reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}

              <div className="mt-4">
                <ReviewForm
                  onSubmit={submitReview}
                  isSubmitting={isSubmitting}
                  submitError={submitError}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
