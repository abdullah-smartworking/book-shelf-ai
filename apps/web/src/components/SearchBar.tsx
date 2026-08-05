interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Shown under the input once results are in. */
  resultLabel: string | null;
}

/**
 * Sticky search input. Icons are inline SVG rather than an icon package — two glyphs
 * do not justify a dependency, and it keeps the bundle free of a network request.
 */
export function SearchBar({ value, onChange, resultLabel }: SearchBarProps): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              BookShelf
            </h1>
            <p className="mt-0.5 text-sm text-muted">A personal book catalogue.</p>
          </div>

          <div className="w-full sm:max-w-sm">
            <div className="relative">
              {/* aria-hidden: decorative. The input's own label carries the meaning. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2
                           text-muted"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
              </svg>

              <label className="sr-only" htmlFor="book-search">
                Search books by title, author or genre
              </label>

              <input
                id="book-search"
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search title, author or genre…"
                autoComplete="off"
                className="w-full rounded-full border border-line bg-surface py-2.5 pr-10 pl-10
                           text-sm text-ink placeholder:text-muted/70
                           focus:border-accent focus:outline-none
                           focus-visible:outline-2 focus-visible:outline-offset-2
                           focus-visible:outline-accent"
              />

              {value !== '' && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center
                             rounded-full text-muted transition-colors hover:bg-accent-soft
                             hover:text-accent"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="size-3.5"
                  >
                    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* aria-live so screen readers hear the result count change without a focus move. */}
            <p aria-live="polite" className="mt-1.5 h-4 pl-4 text-xs text-muted">
              {resultLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
