import { useState } from 'react';

import { CreateListForm } from '../components/CreateListForm';
import { ErrorState } from '../components/states';
import { useLists } from '../hooks/useLists';

/**
 * The reading-lists index: names + book counts, linking to a detail view.
 * Same page shape as CataloguePage (owns only local UI state; the hook owns
 * fetching/mutating).
 */
export function ListsPage({
  onSelectList,
}: {
  onSelectList: (id: string) => void;
}): React.JSX.Element {
  const { lists, isLoading, error, retry, addList, isCreating, createError, removeList } = useLists();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(id: string): Promise<void> {
    setRemovingId(id);
    try {
      await removeList(id);
    } catch {
      // Idempotent-delete philosophy elsewhere in this codebase means failures here
      // are rare (a 404 is treated as success by the same logic) — no per-row error
      // UI for this first pass.
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <h1 className="font-serif text-2xl font-semibold text-ink">Reading lists</h1>
        <p className="mt-1 text-sm text-muted">Organise books into your own lists.</p>

        <div className="mt-6">
          <CreateListForm onSubmit={addList} isSubmitting={isCreating} submitError={createError} />
        </div>

        <div className="mt-8">
          {error !== null ? (
            <ErrorState title="Could not load reading lists" message={error} onRetry={retry} />
          ) : isLoading ? (
            <p aria-busy="true" className="py-8 text-center text-sm text-muted">
              Loading…
            </p>
          ) : lists.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No reading lists yet — create one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line
                             bg-surface p-4"
                >
                  <button type="button" onClick={() => onSelectList(list.id)} className="min-w-0 flex-1 text-left">
                    <p className="font-serif text-base font-semibold text-ink">{list.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {list.bookIds.length} {list.bookIds.length === 1 ? 'book' : 'books'}
                      {list.description !== '' ? ` · ${list.description}` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(list.id)}
                    disabled={removingId === list.id}
                    className="shrink-0 text-xs font-medium text-muted transition-colors
                               hover:text-accent disabled:opacity-60"
                  >
                    {removingId === list.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
