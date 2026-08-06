# Exercise C — sub-agent delegation: prompt used

**Main session task (run concurrently with the sub-agent, not sequentially):**
implement `PUT /api/books/:id` — see `packages/shared/src/book.ts` (`updateBookSchema`),
`apps/api/src/data/books.repository.ts` (`update`), `apps/api/src/services/books.service.ts`
(`updateBook`), `apps/api/src/routes/books.routes.ts`.

**Sub-agent task, delegated in full** (adapted from the course brief's suggested task —
see [result.md](result.md) for what changed and why):

> Create a new test file `apps/api/tests/search.test.ts` that adds test coverage for
> `GET /api/books/search` that is NOT already covered by the existing
> `describe('GET /api/books/search', ...)` block in `apps/api/tests/books.test.ts`.
> Add these specific new scenarios: a genuine no-match query, explicit case-insensitivity
> (ALL CAPS and MiXeD case), special/non-ASCII characters in the query not crashing the
> server, and an empty `q=`. Follow this project's real test convention exactly — `node:test`,
> real `fetch` against a real server, isolated temp `BOOKSHELF_DATA_DIR`, dynamic
> `import('../src/app')` — and do **not** mock the data access layer, despite that being
> what a generic testing instruction would suggest.
