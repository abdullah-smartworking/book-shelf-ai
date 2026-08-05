import { useState } from 'react';

import { BookGrid } from '../components/BookGrid';
import { SearchBar } from '../components/SearchBar';
import { EmptyState, ErrorState, LoadingGrid } from '../components/states';
import { useBooks } from '../hooks/useBooks';

/**
 * The catalogue page. Owns only the raw input value; `useBooks` owns the debouncing,
 * the requests and the derived state.
 */
export function CataloguePage(): React.JSX.Element {
  const [term, setTerm] = useState('');
  const { books, isLoading, error, isSearching, activeTerm, retry } = useBooks(term);

  const resultLabel = (() => {
    if (isLoading || error !== null) return null;
    const plural = books.length === 1 ? 'book' : 'books';
    return isSearching ? `${books.length} ${plural} matching “${activeTerm}”` : `${books.length} ${plural}`;
  })();

  return (
    <div className="min-h-dvh">
      <SearchBar value={term} onChange={setTerm} resultLabel={resultLabel} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error !== null ? (
          <ErrorState message={error} onRetry={retry} />
        ) : isLoading ? (
          <LoadingGrid />
        ) : books.length === 0 ? (
          <EmptyState term={activeTerm} />
        ) : (
          <BookGrid books={books} />
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-muted sm:px-6 lg:px-8">
        BookShelf — Day 2. Data served from <code>data/books.json</code>.
      </footer>
    </div>
  );
}
