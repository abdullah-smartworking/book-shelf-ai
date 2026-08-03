# Day 1 — Code Walkthrough

Every file, what it does, why it exists, and the reasoning behind each decision.
Read this alongside the code.

---

## 0. The shape of the whole thing

```
HTTP request
    ↓
apps/api/src/index.ts        starts the server, handles shutdown
    ↓
apps/api/src/app.ts          the middleware pipeline
    ↓
src/middleware/              express.json → requestLogger
    ↓
src/routes/books.routes.ts   validate input, pick a status code   ← knows HTTP
    ↓
src/services/books.service.ts   filter, sort, paginate, rank      ← knows business rules
    ↓
src/data/books.repository.ts    "find a book", "create a book"    ← knows the collection
    ↓
src/data/jsonStore.ts           read/write a JSON file safely     ← knows the storage
    ↓
data/books.json
```

The one rule: **each layer talks only to the layer directly below it.** No route
touches a file. No service imports `express`. Grep for it — `services/` contains no
`req` or `res`, and `data/` contains no HTTP status codes.

Why bother on a 30-record toy project? Because Day 3 asks you to build an MCP server
over this data. An MCP server has no HTTP request. If the filtering logic lived inside
a route handler, you would have to copy-paste it. Because it lives in
`books.service.ts`, the MCP server imports the same function.

---

## 1. Root configuration

### `package.json`

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": { "dev": "npm run dev --workspace @bookshelf/api" }
}
```

**What:** declares an npm workspaces monorepo — three packages under one
`node_modules` and one lockfile.

**Why:** the spec asks for a monorepo. npm workspaces is the zero-dependency way to
get one; alternatives (pnpm, Turborepo, Nx) add tooling for a benefit that only shows
up at a much larger scale.

**How it works:** `npm install` at the root installs every package's dependencies
once, hoisted, and creates a **symlink** at `node_modules/@bookshelf/shared` pointing
at `packages/shared`. That symlink is why `import { Book } from '@bookshelf/shared'`
resolves without any build step or path alias. Edit a type in `packages/shared` and
the API sees it immediately — no publish, no rebuild.

`"private": true` prevents accidentally publishing to npm and is required for
workspaces to work at all.

`"dev": "npm run dev --workspace @bookshelf/api"` satisfies the spec's requirement
that `npm run dev` **from the root** starts the API.

### `tsconfig.base.json`

Shared compiler options, extended by each package.

| Option | Why |
| --- | --- |
| `"strict": true` | Turns on `noImplicitAny`, `strictNullChecks`, etc. `strictNullChecks` is the one that matters: it forces you to handle `findById()` returning `undefined`, which is exactly the bug class that produces `Cannot read property 'title' of undefined` in production. |
| `"target": "ES2022"` | Node 20+ supports it natively. No downlevelling, so the code you debug is the code you wrote. |
| `"module": "ESNext"` + `"moduleResolution": "bundler"` | Lets you write `import { config } from './config'` with no file extension. With Node's own `NodeNext` resolution you would have to write `'./config.js'` while the file is actually `config.ts` — technically correct, universally confusing. `tsx` handles extensionless resolution at runtime, so `bundler` matches reality here. |
| `"noEmit": true` | `tsc` is used purely as a type checker. `tsx` does the actual running. |
| `"skipLibCheck": true` | Don't typecheck inside `node_modules`. Saves seconds on every run and third-party type bugs are not yours to fix. |

### `.gitignore`

Standard, plus three project-specific entries:

- `data/*.tmp` — the atomic-write temp files (see §4).
- `.env` — reinforced by the Day 1 security reading. Secrets never enter the repo and
  never enter an AI prompt.
- `.claude/settings.local.json` — machine-specific. Note that `CLAUDE.md` (Day 2) **is**
  committed; it is shared project context, not local config.

---

## 2. `packages/shared` — the contract

### Why this package exists at all

On Day 2 you build a React "Add book" form. That form needs to know: which fields are
required, what the max title length is, what a valid year is. Those rules already
exist in the API. There are three ways to handle that:

1. Duplicate them in the frontend → they drift, and the two drift silently.
2. Only validate on the server → the user types for 30 seconds then gets a 400.
3. **Define them once, import from both.** ← this package

### `src/book.ts` — schema-first types

```ts
export const bookSchema = z.object({ id: z.string(), title: z.string(), /* … */ });
export type Book = z.infer<typeof bookSchema>;
```

**The key idea:** the Zod schema is the source of truth and the TypeScript type is
*derived from it*. Not the other way around, and not two parallel declarations.

Why it matters: a TypeScript `interface` is erased at compile time. It gives you
autocomplete, and zero protection at runtime. If `data/books.json` is hand-edited so a
`year` becomes `"1999"` (a string), a TS type says nothing — the code just breaks
later, somewhere else. A Zod schema is a real runtime value that can actually check.

Declaring both separately means they drift. `z.infer` makes drift structurally
impossible: change the schema and every consumer's types update, and any code relying
on the old shape fails to compile.

**`createBookSchema` — the input contract for `POST /api/books`**

```ts
export const createBookSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(300),
  // …
  isbn: z.string().trim().min(10).max(20).nullable().optional().default(null),
});
```

Three deliberate details:

- **`id` and `addedAt` are absent.** Those are the server's to set. Zod's default
  behaviour for unknown keys is to **strip** them, so a client posting
  `{"id": "book_001", "title": "…"}` has `id` silently dropped rather than overwriting
  an existing book. That class of vulnerability is called *mass assignment*, and
  there is a test for it (`ignores client-supplied id and addedAt`).
- **`.trim()` runs before `.min(1)`.** Order matters: `"   "` trimmed is `""`, which
  fails `min(1)`. Validate the other way round and whitespace-only titles get through.
- **`.optional().default(null)`** means "the client may omit this; if omitted it
  becomes `null`". The *output* type is therefore `string | null`, not
  `string | null | undefined` — so no downstream code needs `?? null`.

**The bug I wrote here, and why it is the most instructive thing in the repo**

The first version had:

```ts
const EARLIEST_PRINTED_YEAR = 1450;   // Gutenberg
```

Confident, plausible, and wrong. `data/books.json` — which the same session
generated — contains *Meditations* by Marcus Aurelius, year `180`. Two AI outputs
from one session contradicting each other.

Note what would *not* have caught this:

- **TypeScript:** no. `180` is a valid `number`.
- **The test suite:** no. `createBookSchema` only runs on `POST`; seed data is never
  validated against it.
- **Code review:** probably not. `EARLIEST_PRINTED_YEAR = 1450 // Gutenberg` reads like
  someone who knows the domain.

This is the failure mode your Day 1 reading calls *"confidence without competence"*,
and it is nastier than a syntax error precisely because it looks like expertise.
The floor is now `-800`, with a comment explaining why.

**Query schemas and `z.coerce`**

```ts
page: z.coerce.number().int().min(1).optional().default(1),
```

Everything in `req.query` is a **string** — `?page=2` gives you `"2"`, not `2`.
`z.coerce.number()` converts before validating, so the service layer receives real
numbers and never has to call `parseInt`. `?page=abc` fails validation with a clean
400 instead of silently becoming `NaN` and returning an empty page.

### `src/api.ts` — the response envelope

```ts
{ data: [...], meta: { total, page, limit, totalPages } }   // success
{ error: { code, message, details? } }                       // failure
```

**Why an envelope rather than a bare array?**

1. **Nowhere to put metadata.** Return `[...]` and adding pagination later is a
   breaking change for every client.
2. **Ambiguity.** With a bare array, "did this succeed?" means inspecting the shape.
3. **Machine-readable errors.** `code` is a stable enum; `message` is human prose that
   can be reworded freely. Clients branch on `code`. `if (err.message === 'Not found')`
   is a bug waiting for someone to fix a typo.

`BookSearchHit` adds `matchedOn: ['title']` so a UI can render *why* something
matched — a small thing that makes search feel intentional rather than magic.

### `src/review.ts` / `src/shelf.ts`

Schemas for entities that get endpoints later in the week. `reviewSchema` is used
today (`GET /api/books/:id` embeds reviews); `createReviewSchema` and the shelf
schemas are not wired up yet. Defining them now fixes the shapes so Day 4 does not
have to renegotiate them.

---

## 3. `apps/api` — configuration and errors

### `src/config.ts`

```ts
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..', '..', '..');
```

**Why not `process.cwd()`?** Because `cwd` is wherever the user happened to be when
they typed the command. Run `npm run dev` from the repo root and `cwd` is the root; run
it from `apps/api` and it is not. Resolving from `import.meta.url` — the module's own
location — is stable regardless.

(`import.meta.url` is the ES-module replacement for `__filename`. `__dirname` and
`__filename` do not exist in ESM.)

```ts
dataDir: process.env.BOOKSHELF_DATA_DIR ? path.resolve(...) : path.join(repoRoot, 'data'),
```

**Why the env var?** So the test suite can point at a throwaway temp directory.
Without it, running `npm test` would append test books to your real seed catalogue on
every run — and the `POST` tests genuinely write to disk, because a test that mocks the
filesystem does not prove persistence works.

`jsonBodyLimit: '100kb'` — a trivial denial-of-service guard. Without a cap, Express
will happily buffer a 2 GB request body into memory.

### `src/errors.ts`

```ts
export class AppError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown)
}
export class NotFoundError extends AppError { /* 404, NOT_FOUND */ }
export class ValidationError extends AppError { /* 400, VALIDATION_ERROR */ }
export class ConflictError extends AppError { /* 409, CONFLICT */ }
```

**The idea:** an error carries its own HTTP status. The service layer throws
`new NotFoundError(...)` — it does not know or care that this becomes a 404. One
place (`errorHandler.ts`) does the translation.

**The security-relevant part:** `instanceof AppError` is a whitelist. Anything that
*is* an `AppError` was raised deliberately and its message is safe to show a user.
Anything else that reaches the handler is an unanticipated bug — and gets reported as
a bare `INTERNAL_ERROR` so stack traces, file paths and library internals never leak.
Blanket `res.status(500).json({ error: err.message })` is the common shortcut and it
leaks.

`readonly` on the constructor parameters is TypeScript's *parameter property*
shorthand — it declares and assigns the field in one go.

---

## 4. `src/data/jsonStore.ts` — the interesting file

The mentor notes predict this: *"The JSON file read/write layer is where most bugs
will appear (race conditions, file locking)."* Here are the three problems and the
three fixes.

### Problem 1: torn writes

```ts
await fs.writeFile('data/books.json', JSON.stringify(books));   // ← naive
```

`writeFile` truncates the file to zero bytes, then streams new content in. Kill the
process in that window and `books.json` is truncated, unparseable JSON. Your entire
dataset is gone — not corrupted-but-recoverable, gone.

**Fix — write elsewhere, then rename:**

```ts
const tempFile = `${file}.${randomUUID()}.tmp`;
await fs.writeFile(tempFile, JSON.stringify(items, null, 2) + '\n');
await fs.rename(tempFile, file);
```

`rename()` within one filesystem is **atomic** at the OS level. A reader sees either
the complete old file or the complete new one — never a half-written one. Crash before
the rename and the original is untouched; you just leak a `.tmp` file (which
`.gitignore` covers, and the `catch` block cleans up).

`randomUUID()` in the temp name means two concurrent writes cannot collide on the same
temp path.

### Problem 2: lost updates — the read-modify-write race

This is the important one. Naive version:

```ts
const books = await readCollection('books');   // both requests read 30 books
books.push(newBook);                            // both build a 31-item array
await writeCollection('books', books);          // second write overwrites the first
```

Two simultaneous `POST`s → **both succeed with 201, one book vanishes.** Worse, both
compute the same next id (`book_031`), so you can also end up with duplicate ids. The
`await` is exactly where the interleave happens: Node hands control back to the event
loop, and the second request runs its read before the first has written.

**Fix — one promise chain per collection, acting as a mutex:**

```ts
const writeQueues = new Map<string, Promise<unknown>>();

function enqueue<R>(collection: string, task: () => Promise<R>): Promise<R> {
  const previous = writeQueues.get(collection) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(collection, next.catch(() => undefined));
  return next;
}
```

`writeQueues.get('books')` is "the tail of all book-file work queued so far". Each new
operation chains onto it, so operations run strictly one at a time.

Two subtleties:

- **`previous.then(task, task)`** — the same function is passed as both the success
  and failure handler. If the previous operation rejected, the next one still runs.
  Pass only `.then(task)` and one failure poisons the chain forever.
- **`.catch(() => undefined)` on the *stored* tail, while returning the raw `next`.**
  The stored promise must never be in a rejected state (Node would report an unhandled
  rejection, and the chain would break), but the caller must still see the real error.
  Two different promises, deliberately.

Then the critical section:

```ts
export function mutateCollection<T, R>(collection, mutator) {
  return enqueue(collection, async () => {
    const items = await readCollection<T>(collection);      // read
    const { items: updated, result } = await mutator(items); // modify
    await writeCollectionUnsafe(collection, updated);        // write
    return result;
  });
}
```

Read **and** modify **and** write are all inside one queued task, so the second
request's read happens after the first request's write. This is why
`books.repository.ts` must use `mutateCollection` and never `readCollection` +
`writeCollection` — the latter pair reopens the exact gap.

There is a test for this: `does not lose writes when five books are posted
concurrently` fires five simultaneous `POST`s and asserts all five survive with unique
ids. Comment out the queue and it fails.

### Problem 3: missing or malformed files

`readCollection` treats `ENOENT` and an empty file as `[]` (a fresh clone should work),
and turns a JSON parse failure into a message naming the file — rather than a
`SyntaxError` surfacing from somewhere deep in a route handler.

### What it deliberately does NOT solve

**Multi-process safety.** The lock lives in this process's memory. Run two `node`
processes against the same file and they will clobber each other. Fixing that needs OS
file locking (`flock`) or a real database. The mentor notes say explicitly not to
yak-shave here, and that is correct — but it should be a *known* limitation, not an
accident, which is why it is written down in the file's own doc comment.

---

## 5. `src/data/*.repository.ts` — the collection layer

```ts
export function findAll(): Promise<Book[]> { return readCollection<Book>('books'); }
export async function findById(id: string): Promise<Book | undefined> { … }
export function create(input: NewBook): Promise<Book> { … }
```

**Purpose:** the only code in the project that knows books live in a JSON array. Swap
this file for a Postgres implementation and nothing above it changes. That is not
architecture-astronautics — Day 3 asks you to put an MCP server in front of this data,
and the mentor notes explicitly say the exercise is identical whether the store is
JSON, PostgreSQL or Mongo. This layer is what makes that true.

**`findById` returns `Book | undefined`, not `Book`.** It does not throw. "Not found"
is a legitimate answer to "find me this" — whether that constitutes a 404 is a
business decision, and business decisions belong in the service layer. `strictNullChecks`
then forces the caller to handle it.

### Id generation

```ts
function nextBookId(books: Book[]): string {
  const highest = books.reduce((max, book) => {
    const match = /^book_(\d+)$/.exec(book.id);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  return `book_${String(highest + 1).padStart(3, '0')}`;
}
```

Sequential human-readable ids (`book_031`) because that is what the spec's seed data
uses. A UUID would be more robust and less readable; matching the spec wins.

The trade-off: the id depends on the *current contents of the file*, which is
inherently racy. That is why this function is called **only** from inside
`mutateCollection`, where it is protected by the lock. Call it anywhere else and you
get duplicate ids.

### Why the duplicate-ISBN check lives in the repository, not the service

```ts
return mutateCollection<Book, Book>('books', (books) => {
  if (input.isbn !== null && books.some((b) => b.isbn === input.isbn)) {
    throw new ConflictError(`A book with ISBN ${input.isbn} already exists`);
  }
  const book = { id: nextBookId(books), ...input, addedAt: new Date().toISOString() };
  return { items: [...books, book], result: book };
});
```

Layering purism says validation belongs in the service. But a check in the service
would be: read (service) → check (service) → write (repository) — and two concurrent
requests could both pass the check before either wrote. That is a **time-of-check to
time-of-use** bug.

Inside the mutator, check and write share one critical section. If the mutator throws,
`writeCollectionUnsafe` is never reached, so nothing is persisted. Correctness beat
layer purity here, and that is a judgement call worth being able to defend.

---

## 6. `src/services/books.service.ts` — business logic

No `express` import. No `req`, no `res`. Pure functions over data.

### `listBooks` — filter, sort, paginate

Filters are ANDed. `genre` and `year` are exact matches; **`author` is a substring
match** because `"David Thomas, Andrew Hunt"` should be findable by searching
`"hunt"` — an exact match on a comma-joined author field is useless.

```ts
case 'addedAt': return a.addedAt.localeCompare(b.addedAt);
```

ISO-8601 UTC strings sort **lexicographically in chronological order** — that is the
entire point of the format. So no `new Date()` allocation per comparison.

```ts
const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
```

The `total === 0` guard avoids reporting `totalPages: 0` vs `1` inconsistently for an
empty result. Small, but it is the kind of off-by-one a UI will render as "Page 1 of 0".

### `getBookById`

```ts
const [book, reviews] = await Promise.all([
  booksRepository.findById(id),
  reviewsRepository.findByBookId(id),
]);
```

Two independent reads, issued concurrently. Awaiting them in sequence would double the
latency for no benefit. Sequential `await`s where the second does not depend on the
first is one of the most common avoidable performance mistakes in async code — and one
AI tools make constantly, because sequential reads look natural.

### `createBook` — explicit field construction

```ts
return booksRepository.create({
  title: input.title, author: input.author, genre: input.genre,
  year: input.year, isbn: input.isbn, description: input.description,
  coverUrl: input.coverUrl,
});
```

Not `create({ ...input })`. Zod already stripped unknown keys, so the spread would
probably be safe — but "probably safe" plus a future schema change is how mass-assignment
bugs get reintroduced. Listing fields explicitly means adding a field to the schema
does not silently make it persistable. Defence in depth: two independent mechanisms
have to fail before a client can write a field it should not.

### `searchBooks` — weighted ranking

```ts
const FIELD_WEIGHTS = { title: 8, author: 4, genre: 2, description: 1 };
// …
score += FIELD_WEIGHTS[field];
if (haystack.startsWith(term)) score += FIELD_WEIGHTS[field];   // prefix bonus
```

A linear scan over 30 records in memory. At this size an index would be pure
ceremony — `O(n)` over 30 items is microseconds.

Two cheap refinements that make results feel deliberate:

- **Field weighting** — searching `"ishiguro"` ranks his novels above a book whose
  description merely mentions him.
- **Prefix bonus** — searching `"dun"` puts *Dune* first rather than whichever book
  happens to sit earliest in the file.

`scored.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title))` —
the `||` is a tiebreaker, so equal-scoring results come back in a **stable,
deterministic** order rather than depending on file order.

**Honest note:** search ranking is *not* in the Day 1 brief. It is unrequested scope.

---

## 7. `src/middleware/`

### `validate.ts`

```ts
export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): TypeOf<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError('Request validation failed', formatIssues(result.error));
  return result.data;
}
```

`safeParse` rather than `parse`, so the raw `ZodError` never escapes this module. The
API's error contract stays ours, not Zod's — if Zod 4 changes its error shape, one file
changes.

The return type `TypeOf<S>` is the schema's **output** type, so after this call
`.default()`ed fields are guaranteed present and coerced fields are real numbers. No
optional-chaining noise downstream.

`formatIssues` flattens Zod's issue array into `{ field, message, code }` so a form can
map errors onto inputs directly.

### `errorHandler.ts` — two things that are easy to get catastrophically wrong

**1. It must take exactly four parameters.**

```ts
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => { … };
```

Express identifies error-handling middleware by **`fn.length === 4`** — it literally
counts the arguments. Drop the unused `next` and Express treats it as ordinary
middleware: thrown errors bypass it entirely and you get Express's default HTML error
page, or a hung request. `_next` is unused and load-bearing. A linter that "helpfully"
removes it will break your error handling silently.

**2. It must be registered last.** Express routes errors only to error middleware
registered *after* the code that threw. Middleware order is execution order.

The three cases it handles, in order:

```ts
if (error instanceof AppError) → error.status with error.code and message
if (parserError.type === 'entity.too.large') → 413 PAYLOAD_TOO_LARGE
if (error instanceof SyntaxError && 'body' in error) → 400 INVALID_JSON
otherwise → console.error(full error), respond 500 INTERNAL_ERROR
```

That third case is a genuinely common bug. `express.json()` throws a `SyntaxError` for
malformed JSON. Unhandled, that becomes a **500** — telling the client "server
error" when the client sent broken input. It should be a 400, and there is a test
asserting exactly that.

Debug detail (`details`) is included outside production and suppressed in it — so you
get useful errors locally and leak nothing in production.

`notFoundHandler` exists so an unmatched `/api/*` URL returns **JSON**, not Express's
default HTML page. Any client doing `await response.json()` on an HTML 404 gets an
unhelpful parse error instead of a usable message.

### `requestLogger.ts`

Nine lines instead of adding `morgan`. `res.on('finish')` fires once the response is
flushed, which is the only point at which the status code is known.
`process.hrtime.bigint()` is the monotonic clock — unlike `Date.now()` it cannot go
backwards if the system clock adjusts mid-request.

---

## 8. `src/routes/books.routes.ts` — the trap

```ts
booksRouter.get('/search', …);   // ← MUST be first
booksRouter.get('/', …);
booksRouter.get('/:id', …);
booksRouter.post('/', …);
```

**Express matches routes in registration order, and `/:id` matches the literal string
`"search"`.** Register `/:id` first and `GET /api/books/search?q=dune` returns
`404 No book found with id "search"`.

This is the single most likely bug for an AI tool to introduce here, because generating
routes in CRUD order (list → get → create → search) is the more natural sequence, and
the resulting 404 *looks* like a data problem rather than a routing problem. There is a
test named `is not swallowed by the /:id route` specifically to catch it.

**No `try/catch` anywhere in this file.** Express 5 forwards a rejected promise from an
`async` handler to the error middleware automatically. On Express 4 it does not — every
handler needs a `try/catch` or an `asyncHandler` wrapper, and forgetting one produces a
silently hanging request. So: if a tool suggests adding `asyncHandler` here, it is
pattern-matching on Express 4 tutorials rather than reading `package.json`. That is a
concrete, checkable thing to look for in your Tool B session.

```ts
res.status(201).location(`/api/books/${book.id}`).json({ data: book });
```

`201 Created` plus a `Location` header is the correct REST response for a creation. A
bare `200` is the usual default and loses information the client would otherwise have
to reconstruct.

---

## 9. `src/app.ts` and `src/index.ts` — the split

`createApp()` builds the Express app. `index.ts` starts listening. **The separation is
what makes the tests possible:** they call `createApp().listen(0)` — port `0` means
"any free port" — so tests never collide with a running dev server and several apps can
run at once.

Pipeline order in `createApp`, and why each step is where it is:

```ts
app.disable('x-powered-by');                        // don't advertise the framework
app.use(express.json({ limit: '100kb' }));          // before anything reading req.body
app.use(requestLogger);                             // after the parser, so bad bodies still log
app.get('/health', …);                              // infrastructure, so outside /api
app.use('/api', apiRouter);                         // the actual API
app.use(notFoundHandler);                           // nothing matched → JSON 404
app.use(errorHandler);                              // LAST, and 4 args
```

If `express.json()` came after the routes, `req.body` would be `undefined` in every
handler — a confusing failure that looks like a validation bug.

`index.ts` adds two operational details:

- **`EADDRINUSE` handling** with an actionable message (`PORT=3001 npm run dev`) rather
  than a raw stack trace.
- **Graceful shutdown** on `SIGINT`/`SIGTERM`. `server.close()` stops accepting new
  connections and lets in-flight requests finish — which matters specifically because a
  request might be midway through writing `books.json`, and killing the process at that
  instant is the exact scenario the atomic write in §4 protects against. The two
  mechanisms are complementary: graceful shutdown makes the crash rare, atomic writes
  make it survivable. The `setTimeout(…).unref()` is a 5-second escape hatch so a stuck
  keep-alive connection cannot hang the shutdown forever.

---

## 10. `tests/books.test.ts` — 20 tests, zero dependencies

Node's built-in `node:test` plus global `fetch`. No jest, no vitest, no supertest —
nothing to install, nothing to configure, and the tests exercise real HTTP rather than
a mocked request object.

Two setup details worth understanding:

**1. A throwaway data directory.**

```ts
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
process.env.BOOKSHELF_DATA_DIR = dataDir;
```

The `POST` tests write to disk for real, and then read the file back to prove
persistence — a mocked filesystem would not prove anything. Pointing at the real
`data/` would append junk to your seed catalogue on every run.

**2. `await import()` rather than a static import.**

```ts
process.env.BOOKSHELF_DATA_DIR = dataDir;
const { createApp } = await import('../src/app');
```

`config.ts` reads `process.env` **at module load time**. Static `import` statements are
hoisted to the top of the module and execute before any other code — so a static import
of `app.ts` would load `config.ts` before the env var was set, and the tests would run
against the real data directory. The dynamic `import()` runs where it appears.

This is a subtle, real gotcha. If a tool converts that to a static import, the tests
still pass — while quietly writing to your seed data.

What is covered: the standard envelope; case-insensitive genre filtering; substring
author matching; sort + pagination; over-max `limit` rejection; reviews embedding;
empty-reviews-array-not-omitted; 404 for unknown id; **the route-ordering regression**;
search ranking; required `q`; creation with `201` + `Location` + sequential id;
field-level validation errors; **mass-assignment rejection**; duplicate-ISBN 409;
malformed JSON as 400 not 500; **the five-way concurrent-write race**; JSON 404 for
unknown routes; `/health`.

---

## 11. `scripts/smoke.sh`

16 `curl` checks against a running server, each asserting an expected status code.
This is what you screenshot for the submission's "Quick demo" item — it demonstrates
the happy paths *and* that the error handling actually returns the right codes.

Note that it **POSTs a real book** into `data/books.json` each run, by design (that is
the point of "see it persisted"). Clean up afterwards if you want tidy seed data:

```bash
node -e 'const fs=require("fs"),f="data/books.json";const b=JSON.parse(fs.readFileSync(f,"utf8"));fs.writeFileSync(f,JSON.stringify(b.filter(x=>x.author!=="Smoke Tester"),null,2)+"\n")'
```

---

## 12. Verification results

```
npm run typecheck   → 0 errors across both packages
npm test            → 20 passed, 0 failed (255ms)
./scripts/smoke.sh  → 16 passed, 0 failed
```

Node v24.19.0, npm 11.17.0, express 5.2.1, zod 3.25.76, tsx 4.23.5, typescript 5.9.3.

---

## 13. Known limitations — say these out loud at the check-in

Being able to list what is wrong with your own code is the actual skill the course is
teaching. None of these are accidents.

1. **No multi-process write safety.** The lock is in-process only (§4).
2. **`PUT`/`DELETE`, shelves and reviews endpoints are missing.** In the target spec,
   scheduled for later in the week. Reviews are read-only today.
3. **No authentication.** `userId` is a plain string in the data files. Anyone can post
   a book. The Day 1 reading is explicit that auth is a place to be careful with AI
   output, so it deserves deliberate treatment, not a rushed guess.
4. **The whole collection is read into memory on every request.** Fine at 30 records,
   pointless to optimise now, would need rethinking at 30,000.
5. **The ISBNs in the seed data are plausible but unverified.** They came out of an LLM.
   Treat them as illustrative — this is a small, live example of the fabrication risk in
   §2.2 of the Day 1 reading.
6. **`year` is a bare number.** No distinction between original publication and this
   edition's year. Real catalogues need both.
7. **Search is a substring scan.** No stemming, no fuzzy matching, no typo tolerance.
   `?q=pragmatik` returns nothing.
8. **Unrequested scope.** Pagination, sort, ranking, `/health`, the logger, 409-on-ISBN
   and 20 tests were not asked for. Every one is now a convention the rest of the week
   inherits, decided by a tool rather than by you. That is the strongest argument for
   Day 2's `CLAUDE.md`.
