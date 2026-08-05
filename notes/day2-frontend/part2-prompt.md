# Exercise C Part 2 — the prompt, verbatim (WITH design direction)

Same functional requirements as [Part 1](part1-prompt.md). Everything below the
`DESIGN DIRECTION` heading is what Part 1 did not get.

---

Build the BookShelf catalogue frontend in `apps/web`. Read `CLAUDE.md` first and follow
the repo's existing conventions.

## FUNCTIONAL REQUIREMENTS

Same as before: catalogue page listing books from `GET /api/books`, showing title,
author, genre and year; a search box that queries `GET /api/books/search?q=`; loading
and error states handled; must build and run.

Additionally:
- Import `Book` and the other types from `@bookshelf/shared` — do not redeclare them.
- Talk to the API through a Vite dev-server proxy on `/api`, not a hardcoded
  `http://localhost:3000`, so there is no CORS config and no origin baked into the bundle.
- Debounce the search input so typing does not fire a request per keystroke.
- Add a `dev:web` script at the repo root.

## DESIGN DIRECTION

**Feel:** a quiet, warm library — paper rather than dashboard. Restrained, editorial,
lots of whitespace. Not a generic admin panel, not neon, no gradients.

**Colour palette** — define as Tailwind theme tokens, use the tokens everywhere, never
raw hex in components:

| Token | Light | Role |
|---|---|---|
| `paper` | `#FBF8F3` | page background, warm off-white |
| `surface` | `#FFFFFF` | card background |
| `ink` | `#1C1917` | primary text |
| `muted` | `#78716C` | secondary text, metadata |
| `line` | `#E7E2DA` | hairline borders |
| `accent` | `#B4532A` | terracotta — links, focus rings, active state |
| `accent-soft` | `#F5E6DE` | genre chip background |

Support dark mode via `prefers-color-scheme` by overriding the same tokens. Every colour
pair must stay legible in both.

**Typography:** book titles in a serif (`ui-serif`/Georgia stack — no web fonts, no
network requests). Everything else in the system sans stack. Titles clamp to two lines,
descriptions to three.

**Layout — mobile-first.** Write the base styles for a 375px phone, then scale up with
`sm:` / `lg:` / `xl:`. Responsive card grid: 1 column on mobile → 2 at `sm` → 3 at `lg`
→ 4 at `xl`. Gap grows with the breakpoint. Content capped at `max-w-7xl` and centred.

**Cards:** `rounded-xl`, 1px `line` border, `surface` background, generous padding.
Genre as a small uppercase pill in `accent-soft`. Year and author as muted metadata.

**Hover / focus:** cards lift ~2px on hover with the border warming to `accent` and a
soft shadow, over ~150ms. Keyboard focus must be visible — a 2px `accent` focus ring on
every interactive element. Respect `prefers-reduced-motion`.

**Search bar:** sticky at the top of the page, in a rounded-full input with a leading
magnifier icon (inline SVG, no icon library) and a clear (×) button once there is text.

**States, all styled — no bare "Loading…" text:**
- loading → a grid of shimmer skeleton cards matching the real card geometry
- error → a bordered card with the error message and a Retry button
- empty search → a centred message naming the term that found nothing

**Stack:** Tailwind CSS v4 via `@tailwindcss/vite` (theme in CSS with `@theme`, no
`tailwind.config.js`). No component library, no icon package, no CSS files beyond
`index.css`.

## PROCESS

Ask anything genuinely ambiguous first, plan before writing, build, then refine against
the running app — do not stop at "it compiles".
