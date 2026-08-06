import type { CatalogueBook } from '../hooks/useBooks';

/** True when the API told us which fields matched — i.e. this came from /search. */
function matchedFields(book: CatalogueBook): string[] {
  return 'matchedOn' in book ? book.matchedOn : [];
}

/**
 * One book. An `<article>` rather than a `<div>` because it is a self-contained piece
 * of content, which gives screen readers something to navigate by. It doubles as the
 * click target for the detail page — `role="button"` + `onKeyDown` rather than
 * wrapping in a real `<button>`, since a `<button>` can't contain the `<h2>` this
 * card already uses semantically. Unlike a native button, `role="button"` gets no
 * free Enter/Space activation, so `onKeyDown` has to provide it.
 *
 * The hover treatment (2px lift, border warming to accent, soft shadow) is on the
 * group so the whole card responds as one object. `motion-reduce:hover:translate-y-0`
 * respects the OS "reduce motion" setting.
 */
export function BookCard({
  book,
  onSelect,
}: {
  book: CatalogueBook;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const matched = matchedFields(book);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View details for ${book.title} by ${book.author}`}
      onClick={() => onSelect(book.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(book.id);
        }
      }}
      className="group flex cursor-pointer flex-col rounded-xl border border-line bg-surface p-5
                 transition duration-150 ease-out hover:-translate-y-0.5 hover:border-accent
                 hover:shadow-lg hover:shadow-ink/5 motion-reduce:hover:translate-y-0
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.65rem] font-semibold
                     uppercase tracking-wider text-accent"
        >
          {book.genre}
        </span>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted">{book.year}</span>
      </div>

      <h2 className="clamp-2 font-serif text-lg leading-snug font-semibold text-ink">
        {book.title}
      </h2>

      <p className="mt-1.5 text-sm text-muted">{book.author}</p>

      {book.description !== '' && (
        <p className="clamp-3 mt-3 text-sm leading-relaxed text-muted/90">{book.description}</p>
      )}

      {/* Pushes the footer to the bottom so cards in a row align regardless of text length. */}
      <div className="mt-auto pt-4">
        {matched.length > 0 ? (
          <p className="text-[0.65rem] uppercase tracking-wide text-muted">
            matched on {matched.join(', ')}
          </p>
        ) : (
          book.isbn !== null && (
            <p className="font-mono text-[0.65rem] text-muted/70">{book.isbn}</p>
          )
        )}
      </div>
    </article>
  );
}
