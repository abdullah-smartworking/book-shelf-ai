# Day 1 — Part 2: your Tool B session

**Read this before you open the second tool.** ~60 min.

The Day 1 spec says:

> Switch to a different AI tool. Using the scaffolded project from Part 1, continue
> building out the remaining endpoints (POST, search, GET by ID). **If your first tool
> already got these done, add input validation or error handling using the second
> tool.**

Tool A already built all four endpoints, so you are in the second branch. Good news:
that branch is the *better* comparison. Watching a second tool work inside an existing
codebase tests something Part 1 could not — whether it reads and respects existing
conventions, or barges in with its own.

Pick one: **GitHub Copilot** (VS Code), **Cursor**, or **ChatGPT** in the browser.

---

## Pick ONE of these tasks

Each is genuinely missing, self-contained, and lands in ~45 minutes. Task 1 is the
recommended one — it is the most conventional shape, so any weirdness is clearly the
tool's rather than the task's.

### Task 1 — `PUT /api/books/:id` and `DELETE /api/books/:id` ⭐ recommended

Both are in the project's target spec and neither exists yet.

Paste this brief:

> This is a TypeScript npm-workspaces monorepo. The API is Express 5 in
> `apps/api/src`, layered as `routes/ → services/ → data/`. Read these files before
> writing anything: `apps/api/src/routes/books.routes.ts`,
> `apps/api/src/services/books.service.ts`,
> `apps/api/src/data/books.repository.ts`, `apps/api/src/data/jsonStore.ts`,
> `apps/api/src/errors.ts`, and `packages/shared/src/book.ts`.
>
> Add `PUT /api/books/:id` (partial update) and `DELETE /api/books/:id`, following the
> existing conventions exactly:
>
> - Zod schema `updateBookSchema` in `packages/shared/src/book.ts`. Every field
>   optional, but reject an empty body. `id` and `addedAt` must not be updatable.
> - Repository functions must do read-modify-write inside `mutateCollection()` so the
>   write lock is not bypassed.
> - 404 via `NotFoundError` when the id does not exist. 409 via `ConflictError` if a
>   `PUT` would duplicate another book's ISBN.
> - `PUT` returns `200 { data: updatedBook }`. `DELETE` returns `204` with no body.
> - Add tests to `apps/api/tests/books.test.ts` in the existing `node:test` style.
> - Do not add any npm dependency.

**Then check these five things — this is where you will find your comparison bullets:**

| Check | Why it is a trap |
| --- | --- |
| Did it use `mutateCollection`, or `readCollection` + `writeCollection`? | The naive pair reintroduces the exact lost-update race the store was written to prevent. Very common. |
| Did it wrap handlers in `try/catch` or an `asyncHandler`? | Unnecessary on Express 5. Its presence proves the tool pattern-matched on Express 4 tutorials instead of reading `package.json`. |
| Does `DELETE` return 204 with a body? | `res.status(204).json(...)` is contradictory — 204 means no content. Node will send it anyway. |
| Did it put `PUT /:id` above or below `GET /search`? | Adding routes at the bottom of the file is safe here; adding them at the top is not. |
| Did it use `Partial<Book>` instead of a Zod schema? | Types vanish at runtime. `Partial<Book>` validates nothing. |

### Task 2 — `GET /api/books/:id/reviews` and `POST /api/books/:id/reviews`

`createReviewSchema` already exists in `packages/shared/src/review.ts`, and
`reviews.repository.ts` has reads but no writes. The interesting bit is referential
integrity: posting a review for a non-existent `bookId` must 404, and that check has
to happen against the *books* collection while writing the *reviews* one.

### Task 3 — harden the input validation

Add: a `Retry-After`-less rate limiter, `q` length caps, a check that `coverUrl` is
`https` only, and a global request-timeout middleware. Smaller, and a good test of
whether the tool invents dependencies.

---

## Log as you go — you need this for the submission

Copy this template into `notes/day1-tool-b-log.md` and fill it in **while** you work,
not afterwards. Reconstructed notes are always vaguer than live ones.

```markdown
# Day 1 — Tool B Log

**Tool:** <Copilot / Cursor / ChatGPT> (model, if you can see it)
**Task chosen:** <1 / 2 / 3>
**Time spent:**

## What I told it
<paste the exact prompts, including follow-ups>

## What it produced
- Files it created:
- Files it modified:
- Did it read the existing files first, or start typing immediately?
- Did it match the existing code style (naming, layering, error classes)?

## Where I intervened
1.
2.
3.

## What surprised me
-

## Did it fall into any of the five traps above?
| Trap | Yes/No | What it did |
| --- | --- | --- |
| Bypassed mutateCollection |  |  |
| Added try/catch (Express 4 habit) |  |  |
| 204 with a body |  |  |
| Route ordering |  |  |
| Partial<Book> instead of Zod |  |  |
```

---

## Two rules while you do this

1. **Do not paste secrets.** There are none in this repo, and it should stay that way.
2. **Run `npm test` after the tool finishes, before you believe anything it told you.**
   "I've added the endpoints and they work" is a claim, not evidence. The Day 1
   reading is explicit that tools will assert success over broken code.
