# Reading Lists — API contract

Written before any agent starts, per Exercise B's instructions. All three agents
(backend, tests, frontend) build against **this document only** — not against
each other's code, which they can't see anyway (each runs in its own isolated
git worktree, branched from this commit).

## Data model

A new resource, `data/lists.json` — a top-level JSON array, same convention as
`books.json`/`reviews.json`. Not the same thing as the (still-unbuilt) shelves
feature already flagged in `CLAUDE.md`'s Known Limitations — this is a
deliberately separate resource per the exercise brief, even though the two are
conceptually similar. Worth a note in the write-up, not a reason to merge them.

**Shared types — new file `packages/shared/src/list.ts`, exported from
`packages/shared/src/index.ts` via `export * from './list'` (same pattern as
`review.ts`/`shelf.ts`):**

```ts
import { z } from 'zod';
import type { Book } from './book';

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  bookIds: z.array(z.string()),
  createdAt: z.string(),
});
export type List = z.infer<typeof listSchema>;

export const createListSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  description: z.string().trim().max(500).optional().default(''),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListBooksSchema = z
  .object({
    add: z.array(z.string()).optional().default([]),
    remove: z.array(z.string()).optional().default([]),
  })
  .refine((data) => data.add.length > 0 || data.remove.length > 0, {
    message: 'at least one of add or remove must be non-empty',
  });
export type UpdateListBooksInput = z.infer<typeof updateListBooksSchema>;

/** `GET /api/lists/:id` embeds resolved books, not just ids. */
export interface ListWithBooks extends List {
  books: Book[]; // resolved from bookIds, same order as bookIds
}
```

## Endpoints

Same response envelope as every other BookShelf endpoint: `{ data: T }` on
success (`{ data: T[] }` for the list-all endpoint, no `meta` — lists are
expected to stay small, no pagination needed), `{ error: { code, message,
details? } }` on failure. IDs are `list_001`, `list_002`... — same sequential
scheme as `nextBookId` in `apps/api/src/data/books.repository.ts`.

| Method | Path | Body | Success | Failure |
|---|---|---|---|---|
| `POST` | `/api/lists` | `{ name, description? }` | `201` + `Location: /api/lists/:id` + `{ data: List }` | `400 VALIDATION_ERROR` if `name` missing/empty |
| `GET` | `/api/lists` | — | `200` `{ data: List[] }` | — |
| `GET` | `/api/lists/:id` | — | `200` `{ data: ListWithBooks }` | `404 NOT_FOUND` |
| `PUT` | `/api/lists/:id/books` | `{ add?: string[], remove?: string[] }` | `200` `{ data: List }` | `404 NOT_FOUND` (list); `400 VALIDATION_ERROR` if body invalid/empty, or if any id in `add` isn't a real book in `data/books.json` |
| `DELETE` | `/api/lists/:id` | — | `204` no body | `404 NOT_FOUND` |

**`PUT .../books` semantics:** `add` appends ids not already in `bookIds`
(adding an id already present is a no-op, not a duplicate or an error).
`remove` drops ids if present (removing an id that isn't there is a no-op, not
an error — same idempotent-delete philosophy as `DELETE /api/books/:id`
elsewhere in this codebase, just for a single array entry instead of a row).

## Layering (must match the existing pattern exactly)

- `apps/api/src/data/lists.repository.ts` — only file touching `jsonStore.ts`.
  Writes through `mutateCollection()`. Mirror `books.repository.ts`'s
  `nextBookId`/`create`/`update`/`remove` shapes for `list_NNN` ids.
- `apps/api/src/services/lists.service.ts` — business logic. No `req`/`res`.
  `GET /api/lists/:id`'s book-resolution mirrors `books.service.getBookById`'s
  `Promise.all` pattern for reading two repositories concurrently. The `add`
  validation (do these book ids exist?) reads `booksRepository.findAll()`.
- `apps/api/src/routes/lists.routes.ts` — new top-level router, mounted as
  `apiRouter.use('/lists', listsRouter)` in `apps/api/src/routes/index.ts`. No
  `try/catch`, no `asyncHandler` — this is Express 5.
- Validate with `parseOrThrow(schema, req.body)` from `../middleware/validate`.
- `apps/api/tests/lists.test.ts` — `node:test`, real `fetch`, isolated temp
  `BOOKSHELF_DATA_DIR`, dynamic `import('../src/app')` — mirror
  `apps/api/tests/reviews.test.ts` exactly (it's the newest, cleanest example
  of this project's real integration-test shape).

## Frontend (if built against this contract)

No new dependency, no router — same `useState`-based view switching as
`App.tsx` already uses for the book detail page. Reuse the existing design
tokens (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent-soft`,
`text-accent`) and the `fetchJson` pattern in `apps/web/src/lib/api.ts` for any
new API calls — don't `fetch()` ad hoc from a component.
