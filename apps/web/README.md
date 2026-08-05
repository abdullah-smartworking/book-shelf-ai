# @bookshelf/web

The BookShelf frontend — React 19 + Vite + Tailwind CSS 4.

## Running it

The frontend needs the API up, because it proxies to it.

```bash
npm run dev       # terminal 1 — API on :3000
npm run dev:web   # terminal 2 — Vite on :5173
```

Then open http://localhost:5173.

If the API is on another port:

```bash
BOOKSHELF_API_TARGET=http://localhost:3001 npm run dev:web
```

## Structure

```
src/
├── components/    BookCard, BookGrid, SearchBar, states (loading/error/empty)
├── pages/         CataloguePage
├── hooks/         useBooks (fetch + debounce + abort), useDebouncedValue
├── lib/           api.ts — the only module that calls fetch()
├── App.tsx
├── main.tsx
└── index.css      Tailwind import + @theme design tokens
```

## Two things worth knowing

**No API origin in the bundle.** Components fetch relative `/api/...` paths; the Vite
dev-server proxy in `vite.config.ts` forwards them to the API. That means no CORS setup
on the Express side and nothing to reconfigure per environment.

**Colours are tokens, not hex.** `--color-paper`, `--color-ink`, `--color-accent` and
friends are declared once under `@theme` in `index.css`, which is what makes the
dark-mode block a five-line override instead of an edit to every component. No component
contains a raw hex value and there is no `dark:` variant anywhere.

Types come from `@bookshelf/shared`, so the frontend and the API cannot disagree about
what a `Book` is. The "Add book" form (later this week) will reuse the same
`createBookSchema` the API validates against.
