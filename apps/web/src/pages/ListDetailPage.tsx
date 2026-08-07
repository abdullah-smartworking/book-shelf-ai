import { ErrorState } from '../components/states';
import { useListDetail } from '../hooks/useListDetail';

/**
 * Owns view selection (loading / error / content), same shape as BookDetailPage.
 * Resolved books come straight from `ListWithBooks.books` — no separate lookup.
 */
export function ListDetailPage({
  listId,
  onBack,
  onSelectBook,
}: {
  listId: string;
  onBack: () => void;
  onSelectBook: (id: string) => void;
}): React.JSX.Element {
  const { list, isLoading, error, retry, removeBook, isMutating, mutateError } = useListDetail(listId);

  return (
    <div className="min-h-dvh">
      <div className="border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted transition-colors hover:text-accent"
          >
            ← Back to reading lists
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error !== null ? (
          <ErrorState title="Could not load this list" message={error} onRetry={retry} />
        ) : isLoading || list === null ? (
          <p aria-busy="true" className="py-16 text-center text-sm text-muted">
            Loading…
          </p>
        ) : (
          <>
            <h1 className="font-serif text-2xl font-semibold leading-snug text-ink sm:text-3xl">
              {list.name}
            </h1>
            {list.description !== '' && <p className="mt-1 text-sm text-muted">{list.description}</p>}

            <section className="mt-8">
              <h2 className="font-serif text-lg font-semibold text-ink">Books ({list.books.length})</h2>

              {mutateError !== null && <p className="mt-2 text-sm text-accent">{mutateError}</p>}

              {list.books.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No books on this list yet — add one from a book's page.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {list.books.map((book) => (
                    <li
                      key={book.id}
                      className="flex items-center justify-between gap-4 rounded-xl border
                                 border-line bg-surface p-4"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBook(book.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-serif text-base font-semibold text-ink">{book.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {book.author} · {book.year}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBook(book.id)}
                        disabled={isMutating}
                        className="shrink-0 text-xs font-medium text-muted transition-colors
                                   hover:text-accent disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
