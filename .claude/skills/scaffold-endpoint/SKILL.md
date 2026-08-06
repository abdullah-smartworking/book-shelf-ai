---
name: scaffold-endpoint
description: Scaffold a new BookShelf REST API endpoint (route + service + repository + node:test file, and a shared Zod schema if the resource is new) following this repo's layered conventions. Use when asked to add a new endpoint, resource, or CRUD operation to apps/api — e.g. "add POST /api/books/:id/reviews", "add a DELETE endpoint", "scaffold the shelves API".
---

# Scaffold a BookShelf API endpoint

## When to use
Any request to add or change an `apps/api` HTTP endpoint. Not for frontend work, not
for the MCP server (`apps/mcp-server`).

## Build order (bottom-up — each layer depends on the one below it)
1. **Shared schema** (`packages/shared/src/<resource>.ts`) — only if it doesn't already
   exist. Check first: `book.ts`, `review.ts`, and `shelf.ts` may already define
   `<x>Schema` / `create<X>Schema` for the resource you need. Export it from
   `packages/shared/src/index.ts` via `export * from './<resource>'`.
2. **Repository** (`apps/api/src/data/<resource>.repository.ts`) — the only file that
   touches `jsonStore.ts`. Writes go through `mutateCollection()`, never a bare
   `readCollection` + `writeCollection` pair. New ids follow `<prefix>_NNN`
   (zero-padded, sequential), generated *inside* the mutator from the current
   in-memory array — see `nextBookId` in `books.repository.ts`. Any invariant that
   must be atomic with the write (duplicate check, parent-exists check) goes inside
   the mutator too, for the same reason.
3. **Service** (`apps/api/src/services/<resource>.service.ts`) — business logic only.
   No `req`/`res`, no `import express`. Build the record field-by-field before handing
   it to the repository — never spread the raw validated input; name every field.
   Throw `NotFoundError` / `ConflictError` / `ValidationError` from `../errors`; never
   set a status code here.
4. **Route** — add to an existing router if this is a sub-resource (e.g. reviews nest
   onto `booksRouter` as `/:id/reviews`, not a new top-level router), otherwise create
   `apps/api/src/routes/<resource>.routes.ts`. `parseOrThrow(schema, req.body|req.query)`
   → call the service → pick a status. No `try/catch`, no `asyncHandler`.
5. **Wire it up.** New top-level router: one line in `routes/index.ts`
   (`apiRouter.use('/<resource>', <resource>Router)`). Sub-resource route: nothing to
   wire — it's already on the parent router.
6. **Test** (`apps/api/tests/<resource>.test.ts`) — `node:test`, real `fetch` against a
   real server, an isolated temp `BOOKSHELF_DATA_DIR`, and a *dynamic*
   `await import('../src/app')` issued *after* the env var is set (a static import
   would be hoisted and run before `config.ts` reads it).

## Hard constraints (violate any of these and the change should be rejected)
- Register more specific static paths (`/search`) before `/:id`-style params at the
  *same* segment depth. A sub-path with an extra segment (`/:id/reviews`) does not
  collide with `/:id`, so there's no ordering hazard there.
- Response envelope: single item → `{ data: T }`. Errors are always
  `{ error: { code, message, details? } }`. A simple nested list (e.g. reviews for one
  book) is `{ data: T[] }` with no `meta` — only add `meta`/pagination if the resource
  actually has query params to paginate by.
- `POST` → `201` + `Location` header + `{ data: created }`. Never a bare `200`.
- `DELETE` → `204` with no body, or a `NotFoundError` (→ 404) if nothing matched.
- No `try/catch` in route handlers — Express 5 forwards rejected promises itself.
- Never `fs.readFile`/`writeFile` a `data/*.json` file outside `apps/api/src/data/`.
- Never add an npm dependency without asking first.
- Never `console.log` outside `requestLogger`/`errorHandler`.
- If touching `errorHandler.ts`, never remove the unused `_next` parameter — Express
  identifies error middleware by `fn.length === 4`.

## Anti-patterns seen on this exact codebase — don't do these
- Wrapping a handler in `asyncHandler(...)`. Express 4 muscle memory; this is Express 5.
- `repository.create({ ...req.body })` instead of naming every field.
- Registering routes in "natural" CRUD order (list, get, create, **then** search),
  which puts `/:id` before `/search` and swallows it.
- Adding `meta`/pagination to a nested list endpoint with no query params to paginate.

## Reference example — copied verbatim from this repo

`apps/api/src/routes/books.routes.ts` (`POST /` handler):
```ts
booksRouter.post('/', async (req, res) => {
  const input = parseOrThrow(createBookSchema, req.body);
  const book = await booksService.createBook(input);
  res.status(201).location(`/api/books/${book.id}`).json({ data: book });
});
```

`apps/api/src/services/books.service.ts` (`createBook` — field-by-field, not a spread):
```ts
export async function createBook(input: CreateBookInput): Promise<Book> {
  return booksRepository.create({
    title: input.title,
    author: input.author,
    genre: input.genre,
    year: input.year,
    isbn: input.isbn,
    description: input.description,
    coverUrl: input.coverUrl,
  });
}
```

`apps/api/src/data/books.repository.ts` (`create` — id generation + atomic check
inside the mutator):
```ts
export function create(input: NewBook): Promise<Book> {
  return mutateCollection<Book, Book>(COLLECTION, (books) => {
    if (input.isbn !== null && books.some((book) => book.isbn === input.isbn)) {
      throw new ConflictError(`A book with ISBN ${input.isbn} already exists`, {
        isbn: input.isbn,
      });
    }
    const book: Book = { id: nextBookId(books), ...input, addedAt: new Date().toISOString() };
    return { items: [...books, book], result: book };
  });
}
```

`apps/api/tests/books.test.ts` (isolation setup, abbreviated):
```ts
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(SEED_BOOKS, null, 2), 'utf8');
process.env.BOOKSHELF_DATA_DIR = dataDir;
const { createApp } = await import('../src/app'); // dynamic import — env must be set first
```

## Definition of done
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes, including the new test file
- [ ] `CLAUDE.md`'s "Known Limitations" list no longer claims this endpoint is unbuilt
