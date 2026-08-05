# `GET /api/books/search?q=<term>`

## The short version

Search here is not a search engine — it is one `Array.prototype.filter` over ~30
objects. The interesting work is not the matching, it is the plumbing around it:

- **The `"search"`-is-not-an-id trap.** Express tries routes in the order you
  register them, and `/:id` is a wildcard that will happily swallow the literal
  word `search`. So `/search` goes *above* `/:id` in the file. That single line of
  ordering is the whole fix, and there is a comment on it so nobody "tidies" it later.
- **A missing `?q=` is a client mistake, so Zod refuses it.** `q` is a *required*
  `.trim().min(1)` string in the shared schema, which means the existing
  `parseOrThrow` → `ValidationError` → central error handler path already produces the
  400 `VALIDATION_ERROR` the brief asks for. No new error handling anywhere.
- **Case-insensitivity comes from the `normalise()` helper that is already in the
  service** — the same one `genre` and `author` filtering uses. `DUNE`, `dune` and
  `Dune` collapse to the same key, so they cannot disagree.

Three files change. Nothing new is installed.

---

## 1. `packages/shared/src/book.ts`

The new schema is `listBooksQuerySchema.extend({ q })` rather than a fresh
`z.object`. Two reasons: the sorting/pagination contract of the two endpoints can
never drift apart, and `?q=dune&genre=Science%20Fiction&limit=5` works for free
because the fields are literally the same fields.

```ts
import { z } from 'zod';

/**
 * The canonical shape of a book as it is stored in `data/books.json`.
 *
 * The Zod schema is the single source of truth: the TypeScript type is *derived*
 * from it with `z.infer`. That means the runtime validator and the compile-time
 * type can never drift apart.
 */
export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  genre: z.string(),
  year: z.number().int(),
  isbn: z.string().nullable(),
  description: z.string(),
  coverUrl: z.string().nullable(),
  addedAt: z.string(),
});

export type Book = z.infer<typeof bookSchema>;

/** Fields the server owns. Clients must never be allowed to set these. */
export type ServerOwnedBookFields = 'id' | 'addedAt';

/** A validated, ready-to-persist book minus the server-generated fields. */
export type NewBook = Omit<Book, ServerOwnedBookFields>;

/**
 * Deliberately permissive. The first draft of this schema used 1450 (Gutenberg)
 * as the floor, which sounded authoritative and was wrong: the seed catalogue
 * contains Marcus Aurelius' *Meditations* (c. 180 CE), so the seed data would
 * have failed the validator for the data it seeds. Negative years allow BCE works.
 */
const EARLIEST_ACCEPTED_YEAR = -800;

/** +1 so a book announced for next year can be catalogued now. */
const LATEST_ACCEPTED_YEAR = new Date().getUTCFullYear() + 1;

/**
 * Validation schema for `POST /api/books`.
 *
 * Deliberately does NOT include `id` or `addedAt`. Zod's default behaviour is to
 * *strip* unknown keys, so a client that posts `{"id": "book_001", ...}` has that
 * key silently dropped rather than overwriting an existing record.
 */
export const createBookSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(300),
  author: z.string().trim().min(1, 'author is required').max(200),
  genre: z.string().trim().min(1, 'genre is required').max(100),
  year: z
    .number({ invalid_type_error: 'year must be a number' })
    .int('year must be a whole number')
    .min(EARLIEST_ACCEPTED_YEAR, `year must be ${EARLIEST_ACCEPTED_YEAR} or later`)
    .max(LATEST_ACCEPTED_YEAR, `year must be ${LATEST_ACCEPTED_YEAR} or earlier`),
  isbn: z.string().trim().min(10, 'isbn looks too short').max(20).nullable().optional().default(null),
  description: z.string().trim().max(2000).optional().default(''),
  coverUrl: z.string().url('coverUrl must be a valid URL').nullable().optional().default(null),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

export const BOOK_SORT_FIELDS = ['title', 'author', 'year', 'addedAt'] as const;
export type BookSortField = (typeof BOOK_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Validation schema for the `GET /api/books` query string.
 *
 * Everything in `req.query` arrives as a string, so numeric fields use
 * `z.coerce.number()` to convert before validating.
 */
export const listBooksQuerySchema = z.object({
  genre: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().optional(),
  sort: z.enum(BOOK_SORT_FIELDS).optional().default('addedAt'),
  order: z.enum(SORT_ORDERS).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

/** Longest accepted search term. A 10 kB `?q=` is a probe, not a search. */
const MAX_SEARCH_TERM_LENGTH = 200;

/**
 * Validation schema for the `GET /api/books/search` query string.
 *
 * Built by extending `listBooksQuerySchema` rather than by declaring a new
 * `z.object`, so search and list can never drift apart on sorting or pagination —
 * and `?q=dune&genre=Science%20Fiction&sort=year&limit=5` works without any extra
 * code, because those are the same fields the list endpoint already validates.
 *
 * `q` is the one *required* field in either schema, and that is what satisfies the
 * "missing `q` is a 400, not an empty result set" rule: `parseOrThrow` throws
 * `ValidationError` before the service is ever called. Three cases collapse to the
 * same 400:
 *
 *   - `?q` omitted entirely      → `required_error`
 *   - `?q=` or `?q=%20%20`       → `.trim()` runs first, then `.min(1)` fails
 *   - `?q=a&q=b`                 → Express parses a repeated key as `string[]`,
 *                                  which trips `invalid_type_error`
 *
 * Note the `.trim().min(1)` order: Zod applies string checks in the order they are
 * chained, so trimming happens before the length check. Reversed, `?q=%20` would be
 * accepted and then searched for as an empty string, which matches every book.
 */
export const searchBooksQuerySchema = listBooksQuerySchema.extend({
  q: z
    .string({
      required_error: 'q is required',
      invalid_type_error: 'q must be a single string',
    })
    .trim()
    .min(1, 'q must not be empty')
    .max(MAX_SEARCH_TERM_LENGTH, `q must be ${MAX_SEARCH_TERM_LENGTH} characters or fewer`),
});

export type SearchBooksQuery = z.infer<typeof searchBooksQuerySchema>;
```

> If `packages/shared/src/index.ts` re-exports with `export * from './book'`, the two
> new exports are already public. If it lists names explicitly, add
> `searchBooksQuerySchema` and `SearchBooksQuery` there.

## 2. `apps/api/src/routes/books.routes.ts`

The only substantive thing here is *where* the handler sits.

```ts
import { Router } from 'express';

import { createBookSchema, listBooksQuerySchema, searchBooksQuerySchema } from '@bookshelf/shared';

import { parseOrThrow } from '../middleware/validate';
import * as booksService from '../services/books.service';

/**
 * Route layer = HTTP only. Its whole job is: validate input, call a service,
 * choose a status code. No business logic, no file access.
 *
 * Note there is no try/catch anywhere below. Express 5 (unlike Express 4)
 * automatically forwards a rejected promise from an async handler to the error
 * middleware. On Express 4 every one of these handlers would need a try/catch or an
 * `asyncHandler` wrapper, and forgetting one produces a silently hanging request.
 * If a tool suggests `asyncHandler` here, it is pattern-matching on Express 4.
 */
export const booksRouter = Router();

/** `GET /api/books` — list with optional filters, sorting and pagination. */
booksRouter.get('/', async (req, res) => {
  const query = parseOrThrow(listBooksQuerySchema, req.query);
  const books = await booksService.listBooks(query);
  res.json(books);
});

/**
 * `GET /api/books/search?q=<term>` — substring search over title, author, genre.
 *
 * REGISTRATION ORDER IS LOAD-BEARING: this must stay above `GET /:id`.
 *
 * Express tries routes in the order they were registered and `:id` is a wildcard
 * that matches any single path segment, including the literal string `search`. If
 * `/:id` were registered first it would win, bind `id = "search"`, call
 * `getBookById('search')` and return `404 NOT_FOUND — No book found with id
 * "search"`. That failure is quietly wrong rather than loud: the endpoint appears to
 * exist, returns valid JSON in the house envelope, and only ever 404s. Nothing else
 * in the file cares about order, so please leave the comment attached if these
 * handlers are ever reshuffled or alphabetised.
 *
 * Narrowing the param instead is not available to us: Express 5 moved to
 * path-to-regexp v8, which removed inline regex groups like `/:id(book_\\d+)`.
 * Ordering literal segments before parameterised ones is the supported fix.
 */
booksRouter.get('/search', async (req, res) => {
  const query = parseOrThrow(searchBooksQuerySchema, req.query);
  const results = await booksService.searchBooks(query);
  res.json(results);
});

/** `GET /api/books/:id` — single book with its reviews embedded. */
booksRouter.get('/:id', async (req, res) => {
  const book = await booksService.getBookById(req.params.id);
  res.json({ data: book });
});

/**
 * `POST /api/books` — create a book.
 *
 * 201 Created plus a `Location` header pointing at the new resource is the correct
 * REST response; a bare 200 is the usual AI default and loses information the
 * client would otherwise not have to reconstruct.
 */
booksRouter.post('/', async (req, res) => {
  const input = parseOrThrow(createBookSchema, req.body);
  const book = await booksService.createBook(input);
  res.status(201).location(`/api/books/${book.id}`).json({ data: book });
});
```

## 3. `apps/api/src/services/books.service.ts`

`listBooks` and `searchBooks` are now the same three steps — *fetch → narrow →
sort/paginate* — differing only in the "narrow" predicate. I pulled the identical
sort-and-slice tail out into one private `selectBooks()` helper so the two endpoints
cannot produce differently-shaped `meta`. `listBooks`' observable behaviour is
unchanged; the code inside it just moved.

Two small notes flagged inline below: I corrected the `normalise()` doc comment
(it claimed accent-insensitivity it does not implement) without changing its
behaviour — see *Notes* for the one-line change if you do want accent folding.

```ts
import type {
  ApiListResponse,
  Book,
  BookSortField,
  BookWithReviews,
  CreateBookInput,
  ListBooksQuery,
  SearchBooksQuery,
  SortOrder,
} from '@bookshelf/shared';

import * as booksRepository from '../data/books.repository';
import * as reviewsRepository from '../data/reviews.repository';
import { NotFoundError } from '../errors';

/**
 * Service layer = business logic. It knows about filtering rules, sort semantics,
 * pagination and what a 404 means. It does not know about HTTP (no `req`/`res`
 * in this file) and it does not know about JSON files (that is the repository).
 *
 * Keeping HTTP out means these functions are directly unit-testable and reusable
 * from a CLI, a cron job, or an MCP server (Day 3) without dragging Express along.
 */

/**
 * Case-insensitive comparison key.
 *
 * (This comment used to also claim accent-insensitivity, which the implementation
 * never did — `normalise('Brontë') !== normalise('Bronte')`. Corrected the comment
 * rather than the code, so no existing filter behaviour changes silently.)
 */
function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function compareBooks(a: Book, b: Book, field: BookSortField): number {
  switch (field) {
    case 'year':
      return a.year - b.year;
    case 'title':
      return a.title.localeCompare(b.title);
    case 'author':
      return a.author.localeCompare(b.author);
    case 'addedAt':
      // ISO-8601 UTC strings sort lexicographically in chronological order, so
      // there is no need to construct Date objects for every comparison.
      return a.addedAt.localeCompare(b.addedAt);
  }
}

function applyOrder(comparison: number, order: SortOrder): number {
  return order === 'asc' ? comparison : -comparison;
}

/**
 * The shared tail of every list-shaped endpoint: sort, then cut one page out, then
 * wrap in the standard `{ data, meta }` envelope.
 *
 * Taking a structural `Pick<...>` rather than a whole `ListBooksQuery` keeps this
 * honest about what it reads, and lets `searchBooksQuerySchema`'s output — or any
 * future list endpoint's — pass without a cast.
 */
function selectBooks(
  books: Book[],
  query: Pick<ListBooksQuery, 'sort' | 'order' | 'page' | 'limit'>,
): ApiListResponse<Book> {
  const sorted = [...books].sort((a, b) => applyOrder(compareBooks(a, b, query.sort), query.order));

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  const offset = (query.page - 1) * query.limit;

  return {
    data: sorted.slice(offset, offset + query.limit),
    meta: { total, page: query.page, limit: query.limit, totalPages },
  };
}

/**
 * The structured filters, ANDed together. `genre` and `year` are exact matches (a
 * genre picker in the UI sends an exact value); `author` is a substring match,
 * because `"David Thomas, Andrew Hunt"` should be findable by searching `"hunt"`.
 */
function matchesFilters(
  book: Book,
  query: Pick<ListBooksQuery, 'genre' | 'author' | 'year'>,
): boolean {
  if (query.genre !== undefined && normalise(book.genre) !== normalise(query.genre)) {
    return false;
  }
  if (query.author !== undefined && !normalise(book.author).includes(normalise(query.author))) {
    return false;
  }
  if (query.year !== undefined && book.year !== query.year) {
    return false;
  }
  return true;
}

/**
 * The fields a free-text `?q=` looks at, per the spec: title, author, genre.
 *
 * `description` is deliberately excluded. Including it would make `?q=war` match
 * every blurb that mentions a war, and the caller has no way to tell *why* a book
 * matched — the search would feel broken rather than broad. Adding it later is one
 * line here and nowhere else, which is the point of having this list in one place.
 */
function searchableFields(book: Book): readonly string[] {
  return [book.title, book.author, book.genre];
}

/**
 * A book matches when the normalised term appears anywhere inside any searchable
 * field. Both sides go through `normalise`, so case never enters into it: `DUNE`,
 * `dune` and `Dune` all become `dune` before the comparison and are guaranteed to
 * return identical hits.
 *
 * `String.prototype.includes` (not a `RegExp`) is what makes partial matching safe
 * as well as simple — `?q=prag` matches *The Pragmatic Programmer*, while
 * `?q=c++` or `?q=.*` are treated as the literal characters a user typed rather
 * than as a pattern. Building a RegExp from user input here would need escaping and
 * would open the door to catastrophic backtracking for zero benefit.
 */
function matchesSearchTerm(book: Book, term: string): boolean {
  const needle = normalise(term);
  return searchableFields(book).some((field) => normalise(field).includes(needle));
}

/**
 * `GET /api/books`
 *
 * Filters are ANDed together — see `matchesFilters` for the per-field semantics.
 */
export async function listBooks(query: ListBooksQuery): Promise<ApiListResponse<Book>> {
  const all = await booksRepository.findAll();

  return selectBooks(
    all.filter((book) => matchesFilters(book, query)),
    query,
  );
}

/**
 * `GET /api/books/search?q=<term>`
 *
 * `query.q` is guaranteed to be a non-empty, trimmed string: the route validated it
 * with `searchBooksQuerySchema`, so an absent or blank term became a 400
 * `VALIDATION_ERROR` before this function was reached. There is deliberately no
 * `if (!query.q)` guard here — a second, quieter policy for the empty case is how
 * "missing q returns everything" bugs get in.
 *
 * The term is ANDed with the structured filters, not substituted for them, so
 * `?q=dune&genre=Science Fiction` narrows rather than widens. Results come back
 * through the same `selectBooks` tail as the list endpoint, which is what makes the
 * envelope and `meta` byte-for-byte identical in shape between the two.
 *
 * A linear scan is the right implementation at ~30 records: the whole catalogue is
 * already in memory after `findAll()`, and any index would have to be invalidated on
 * every `POST /api/books` — strictly more code and more failure modes than the loop
 * it replaces. Revisit at the point where the JSON file becomes a real database,
 * where this becomes a `WHERE ... ILIKE` in the repository.
 */
export async function searchBooks(query: SearchBooksQuery): Promise<ApiListResponse<Book>> {
  const all = await booksRepository.findAll();

  return selectBooks(
    all.filter((book) => matchesSearchTerm(book, query.q) && matchesFilters(book, query)),
    query,
  );
}

/**
 * `GET /api/books/:id`
 *
 * The spec says "get a single book (with reviews)", so reviews are embedded. Both
 * reads are issued concurrently with `Promise.all` — they are independent, and
 * awaiting them in sequence would double the latency for no reason.
 */
export async function getBookById(id: string): Promise<BookWithReviews> {
  const [book, reviews] = await Promise.all([
    booksRepository.findById(id),
    reviewsRepository.findByBookId(id),
  ]);

  if (book === undefined) {
    throw new NotFoundError(`No book found with id "${id}"`, { id });
  }

  return { ...book, reviews };
}

/**
 * `POST /api/books`
 *
 * `input` is already validated by the route. The object handed to the repository is
 * built field by field rather than spread from the request body — so even if an
 * attacker gets an unexpected key past validation, it can never reach the file.
 */
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

## 4. `apps/api/src/services/books.service.search.test.ts` — optional

You didn't ask for tests, so this is a separate, deletable file with a name that
cannot collide with an existing `books.service.test.ts`. It is written to assert
*invariants*, not seed-data trivia: it derives its search term from whatever is
actually in `data/books.json`, so it will not break when the catalogue changes. It
only reads.

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listBooksQuerySchema, searchBooksQuerySchema } from '@bookshelf/shared';

import { listBooks, searchBooks } from './books.service';

/** A word that is guaranteed to be present in the real catalogue, plus its book. */
async function aRealTitleWord(): Promise<{ id: string; word: string }> {
  const { data } = await listBooks(listBooksQuerySchema.parse({ limit: 1 }));
  const book = data[0];
  assert.ok(book, 'seed catalogue is empty — nothing to search for');

  const word = book.title.split(/\s+/).find((part) => part.length > 2) ?? book.title;
  return { id: book.id, word };
}

describe('searchBooksQuerySchema', () => {
  it('rejects a missing q so the route can return 400, not an empty page', () => {
    assert.equal(searchBooksQuerySchema.safeParse({}).success, false);
  });

  it('rejects blank and whitespace-only q', () => {
    assert.equal(searchBooksQuerySchema.safeParse({ q: '' }).success, false);
    assert.equal(searchBooksQuerySchema.safeParse({ q: '   ' }).success, false);
  });

  it('rejects a repeated ?q= (Express hands us an array)', () => {
    assert.equal(searchBooksQuerySchema.safeParse({ q: ['a', 'b'] }).success, false);
  });

  it('trims q and applies the list defaults', () => {
    const parsed = searchBooksQuerySchema.parse({ q: '  dune  ' });
    assert.equal(parsed.q, 'dune');
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 20);
    assert.equal(parsed.sort, 'addedAt');
    assert.equal(parsed.order, 'desc');
  });
});

describe('searchBooks', () => {
  it('finds a book by a partial, differently-cased title word', async () => {
    const { id, word } = await aRealTitleWord();
    const partial = word.slice(0, Math.max(3, word.length - 1));

    const { data, meta } = await searchBooks(searchBooksQuerySchema.parse({ q: partial }));

    assert.ok(
      data.some((book) => book.id === id),
      `expected ${id} in results for "${partial}"`,
    );
    assert.ok(meta.total >= 1);
  });

  it('returns identical hits for UPPER, lower and Mixed case', async () => {
    const { word } = await aRealTitleWord();

    const ids = await Promise.all(
      [word.toUpperCase(), word.toLowerCase(), word].map(async (q) => {
        const { data } = await searchBooks(searchBooksQuerySchema.parse({ q }));
        return data.map((book) => book.id);
      }),
    );

    assert.deepEqual(ids[0], ids[1]);
    assert.deepEqual(ids[1], ids[2]);
  });

  it('returns an empty page with a well-formed envelope when nothing matches', async () => {
    const { data, meta } = await searchBooks(
      searchBooksQuerySchema.parse({ q: 'zzz-no-such-book-zzz' }),
    );

    assert.deepEqual(data, []);
    assert.equal(meta.total, 0);
    assert.equal(meta.totalPages, 0);
    assert.equal(meta.page, 1);
  });

  it('matches on author and on genre, not just title', async () => {
    const { data } = await listBooks(listBooksQuerySchema.parse({ limit: 1 }));
    const book = data[0];
    assert.ok(book);

    const byAuthor = await searchBooks(searchBooksQuerySchema.parse({ q: book.author }));
    const byGenre = await searchBooks(searchBooksQuerySchema.parse({ q: book.genre }));

    assert.ok(byAuthor.data.some((hit) => hit.id === book.id));
    assert.ok(byGenre.data.some((hit) => hit.id === book.id));
  });
});
```

Run with the project's existing runner:

```bash
npx tsx --test apps/api/src/services/books.service.search.test.ts
```

---

## Verifying by hand

```bash
# partial + case-insensitive
curl -s 'http://localhost:3000/api/books/search?q=prag'
curl -s 'http://localhost:3000/api/books/search?q=DUNE'
curl -s 'http://localhost:3000/api/books/search?q=dune'

# the ordering trap: this must NOT 404 with 'No book found with id "search"'
curl -si 'http://localhost:3000/api/books/search?q=a' | head -1     # HTTP/1.1 200 OK

# missing / blank q → 400 VALIDATION_ERROR
curl -si 'http://localhost:3000/api/books/search'      | head -1     # HTTP/1.1 400 Bad Request
curl -s  'http://localhost:3000/api/books/search?q='
curl -s  'http://localhost:3000/api/books/search?q=%20%20'

# composes with the list params it inherited
curl -s 'http://localhost:3000/api/books/search?q=e&sort=year&order=asc&limit=3'
```

Success (`200`):

```json
{
  "data": [
    {
      "id": "book_007",
      "title": "The Pragmatic Programmer",
      "author": "David Thomas, Andrew Hunt",
      "genre": "Programming",
      "year": 1999,
      "isbn": "9780135957059",
      "description": "…",
      "coverUrl": null,
      "addedAt": "2026-07-14T09:12:03.114Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

Missing or blank `q` (`400`), straight out of the existing error handler:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "q", "message": "q is required", "code": "invalid_type" }]
  }
}
```

## Notes and things I chose not to do

- **No dependencies added.** `filter` + `toLowerCase` + `includes` is the entire
  engine. Nothing was installed, and nothing in `package.json` changes.
- **No relevance ranking.** Results come back in the same `addedAt desc` default
  order as the list endpoint. Real relevance (title hit beats genre hit, prefix beats
  mid-word) means a score field, which means either polluting `Book` or extending
  `PaginationMeta` — both are contract changes to `packages/shared/src/api.ts` that go
  well past the brief. `?sort=` covers the practical need for now.
- **No multi-word tokenisation.** `?q=pragmatic programmer` is matched as one literal
  substring, so it hits, but `?q=programmer pragmatic` does not. Requirement 3 asks for
  substring matching and that is what this is. If you want AND-across-tokens later it
  is a contained change to `matchesSearchTerm` and nothing else — split `needle` on
  whitespace and `.every()` instead of comparing the whole string.
- **`description` is not searched** — reasoning in the comment on `searchableFields`.
  Deliberate, and a one-line change if you disagree.
- **Accents**: `normalise()` is case-insensitive but not accent-insensitive, so
  `?q=bronte` will not find *Brontë*. I left the behaviour alone (changing it would
  silently change the existing `genre`/`author` filters too) and fixed the comment that
  claimed otherwise. If you do want it, it is dependency-free and one line — but note
  it widens list filtering as well as search:

  ```ts
  function normalise(value: string): string {
    return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }
  ```

- **Route ordering is enforced only by convention.** If you'd rather it not be, the
  robust version is a `booksRouter.get('/:id', …)` handler that rejects ids failing
  `/^book_\d+$/` with a `ValidationError` — then a future stray `/api/books/anything`
  is a clear 400 instead of a 404. That is a behaviour change to an existing endpoint,
  so I left it out and used the comment instead.
