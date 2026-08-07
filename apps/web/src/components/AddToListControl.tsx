import { useState } from 'react';

import { ApiError, updateListBooks } from '../lib/api';
import { useLists } from '../hooks/useLists';

/**
 * First-pass "add to book to a list" affordance for the book detail page: a
 * dropdown of existing lists plus one button. Deliberately no "create a new list"
 * shortcut inline here — that would mean duplicating CreateListForm or navigating
 * away mid-flow, and the Reading Lists tab already covers creation. This is a
 * guessed scope boundary (the contract specifies endpoints, not UI); flagging it
 * rather than deciding it silently.
 */
export function AddToListControl({ bookId }: { bookId: string }): React.JSX.Element {
  const { lists, isLoading, error } = useLists();
  const [selectedListId, setSelectedListId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleAdd(): Promise<void> {
    if (selectedListId === '') return;
    setIsAdding(true);
    setStatus(null);
    try {
      await updateListBooks(selectedListId, { add: [bookId] });
      const listName = lists.find((list) => list.id === selectedListId)?.name ?? 'that list';
      setStatus(`Added to “${listName}”.`);
    } catch (cause) {
      setStatus(cause instanceof ApiError ? cause.message : 'Could not add to that list.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <h3 className="font-serif text-sm font-semibold text-ink">Add to a reading list</h3>

      {isLoading ? (
        <p className="mt-2 text-xs text-muted">Loading your reading lists…</p>
      ) : error !== null ? (
        <p className="mt-2 text-xs text-muted">{error}</p>
      ) : lists.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          No reading lists yet — create one from the Reading Lists tab first.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor="add-to-list-select" className="sr-only">
            Choose a reading list
          </label>
          <select
            id="add-to-list-select"
            value={selectedListId}
            onChange={(event) => setSelectedListId(event.target.value)}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Choose a list…</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedListId === '' || isAdding}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white
                       transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isAdding ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      {status !== null && <p className="mt-2 text-xs text-muted">{status}</p>}
    </div>
  );
}
