import type { CatalogueBook } from '../hooks/useBooks';
import { BookCard } from './BookCard';

/**
 * The responsive grid: 1 column on a phone, 2 at `sm`, 3 at `lg`, 4 at `xl`, with the
 * gap widening as the screen does. Mobile-first — the unprefixed classes are the phone
 * layout and every breakpoint prefix scales it up.
 */
export function BookGrid({
  books,
  onSelectBook,
}: {
  books: CatalogueBook[];
  onSelectBook: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onSelect={onSelectBook} />
      ))}
    </div>
  );
}
