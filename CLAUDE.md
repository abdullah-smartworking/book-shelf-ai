# Project Overview

BookShelf is a personal book-catalogue REST API (and, from Day 2, a React frontend) —
a simplified Goodreads. Users browse and search books, organise them onto shelves, and
leave reviews. It is an npm-workspaces monorepo built incrementally as a 5-day
AI-Enabled Developer course project, so **prefer the smallest change that satisfies the
current day's brief** over a general solution for a problem we do not have yet.

# Tech Stack

Runtime: Node.js 20+ (dev machine runs 24) | API: Express 5 | Validation: Zod 3
Language: TypeScript, `strict` | Frontend: React 19 + Vite 8 + Tailwind CSS 4
Data: JSON files, no database | Tests: **`node:test` via `tsx --test`, NOT Jest**
Runner: `tsx` — there is no build step and no `dist/`; `.ts` files execute directly.

# Commands

Run from the repo root. `npm run dev` starts the API only.

```
npm install              # workspaces: apps/*, packages/*
npm run dev              # API on :3000 (PORT=3001 to override)
npm run dev:web          # Vite dev server on :5173, proxies /api to the API
npm test                 # 20 integration tests, isolated temp data dir
npm run typecheck        # tsc --noEmit across both workspaces
./scripts/smoke.sh       # end-to-end curl script against a running server
```

# Architecture

One rule: **each layer only calls the one directly below it.**

```
routes/      HTTP only — validate input, pick a status code. Never touches a file.
services/    business logic. No req/res, no express import. Reusable from a CLI or MCP server.
data/*.repository.ts   knows "books are a collection"
data/jsonStore.ts      knows "a collection is a JSON file"
data/*.json
```

Day 3 adds an MCP server over this data, and it has no HTTP request — so logic left in a
route handler would have to be copy-pasted. That is why it lives in `services/`.

# Conventions

- **Response envelope.** Success is `{ data: T }` (plus `meta` for lists/search).
  Failure is `{ error: { code, message, details? } }`. Never return a bare array.
- **Types are derived, never declared twice.** Write a Zod schema in
  `packages/shared/src/`, then `export type Book = z.infer<typeof bookSchema>`.
- **Validate at the edge** with `parseOrThrow(schema, req.query | req.body)` from
  `middleware/validate.ts`. Raw `ZodError` must never escape that module.
- **Throw, don't set status codes.** `NotFoundError`, `ValidationError`,
  `ConflictError` from `../errors` carry their own status. Services throw; the central
  error handler in `middleware/errorHandler.ts` is the only place status is set.
- **No `try/catch` in route handlers.** Express 5 auto-forwards rejected promises to
  the error middleware. If you are reaching for `asyncHandler`, you are pattern-matching
  on Express 4 — check `package.json` first.
- `req.query` values are always strings — numeric params need `z.coerce.number()`.
- Early returns over nested `if/else`. No `any` — use `unknown` and narrow.
- Comments explain *why*, not *what*; load-bearing oddities must say so.
- Frontend: Tailwind utilities, mobile-first (`sm:`/`lg:` to scale up), no CSS beyond
  `index.css`. `apps/web` imports types and schemas from `@bookshelf/shared`.

# Data Layer

- All data is in `/data/*.json` (`books.json`, `shelves.json`, `reviews.json`), each a
  top-level JSON array. Access **only** through `apps/api/src/data/` — never
  `fs.readFile` a data file from a route or service.
- IDs are sequential prefixed strings: `book_001`, `shelf_001`, `review_001` — not UUIDs.
- Writes are atomic (temp file + `rename`) and serialised per collection by a
  promise-chain mutex in `jsonStore.ts`. Use `mutateCollection()` for read-modify-write;
  a bare `readCollection` + `writeCollection` pair reintroduces the lost-update race
  that mutex exists to prevent.
- `BOOKSHELF_DATA_DIR` points the store at a temp directory — that is how tests avoid
  touching seed data. Never let a test write to the real `/data`.

# What NOT to Do

- **Don't add a real database or an ORM.** JSON files are a deliberate constraint.
- **Don't add npm dependencies without asking** — no search library, no `morgan`, no
  Jest, no Axios. The current tree is 85 packages and stays small on purpose.
- **Don't register `/search` after `/:id`** in `books.routes.ts`. Express matches in
  registration order and `:id` will happily match the literal string `"search"`,
  turning `GET /api/books/search?q=dune` into a 404. There is a test for this.
- **Don't remove the unused `_next` parameter** from `errorHandler`. Express identifies
  error middleware by `fn.length === 4`; dropping it silently breaks all error handling.
- **Don't `console.log` outside `requestLogger` and the error handler.**
- **Don't edit `data/*.json` by hand to add records** — POST through the API so IDs and
  `addedAt` stay consistent.
- **Don't change `packages/shared` without checking both apps** — the API and the web
  app import the same schemas, so a change there is a change to both.
- **Don't widen scope.** If the brief says four endpoints, build four. Flag anything you
  think is missing instead of adding it unasked.

# Known Limitations (honest, not aspirational)

- The write mutex is **in-process only**. Two `node` processes on the same file still
  clobber each other. Acceptable here; would not be in production.
- **No auth, no rate limiting, no CORS config.** `userId` is a plain string on reviews
  and shelves; nothing verifies it.
- **Seed data is never validated** against `createBookSchema` — that schema only runs on
  `POST`. The two can drift (they already did once: an early `year >= 1450` floor
  contradicted *Meditations*, c. 180 CE, in our own seed data).
- Search is an O(n) in-memory substring scan with hand-tuned field weights. Correct at
  30 records; not a search engine.
- `PUT`/`DELETE /api/books/:id`, the shelves endpoints and the reviews endpoints are in
  the target spec but **not yet implemented**.
