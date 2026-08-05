# Round 2 — Rich context: the prompt, verbatim

Structured into the four blocks the exercise prescribes: project overview, existing
code, conventions, specific task + constraints. Same model, same task, same lack of
repository access as Round 1 — **the prompt is the only variable.**

---

## 1. PROJECT OVERVIEW

BookShelf is a personal book-catalogue REST API — think a simplified Goodreads. It is
an npm-workspaces monorepo:

```
bookshelf/
├── apps/api/              # Express 5 REST API (TypeScript, run with tsx — no build step)
│   ├── src/routes/        # HTTP layer only
│   ├── src/services/      # business logic, no req/res
│   ├── src/data/          # JSON file access layer
│   └── src/middleware/    # validation, error handling, logging
├── packages/shared/       # Zod schemas + derived TS types, imported by BOTH apps
└── data/*.json            # the entire "database": books.json, reviews.json, shelves.json
```

Runtime: Node 20+ / Express 5 / Zod 3 / TypeScript strict / tests via `node:test`
(`tsx --test`). There is no database and no ORM — `data/books.json` is a single JSON
array of ~30 books. There is no build step; `tsx` runs `.ts` directly.

## 2. EXISTING CODE

These are the actual files you will be extending. Match them.

### `packages/shared/src/book.ts`

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
```

### `packages/shared/src/api.ts`

```ts
import type { Book } from './book';
import type { Review } from './review';

/**
 * Every successful response is wrapped in `{ data: ... }` and every failure in
 * `{ error: { code, message } }`.
 *
 * Why an envelope? A bare array (`[...]`) leaves nowhere to put pagination info
 * later without breaking every client, and it makes "is this a success or an
 * error?" a matter of guessing the shape. One consistent envelope means the
 * Day 2 frontend can write a single `fetchJson()` helper.
 */
export interface PaginationMeta {
  /** Total records matching the filters, before pagination. */
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

/** Machine-readable error codes. Clients should branch on `code`, never on `message`. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode | string;
    message: string;
    /** Field-level validation issues, or debug info outside production. */
    details?: unknown;
  };
}

/** `GET /api/books/:id` returns the book with its reviews embedded. */
export interface BookWithReviews extends Book {
  reviews: Review[];
}
```

### `apps/api/src/routes/books.routes.ts`

```ts
import { Router } from 'express';

import { createBookSchema, listBooksQuerySchema } from '@bookshelf/shared';

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

### `apps/api/src/services/books.service.ts`

```ts
import type {
  ApiListResponse,
  Book,
  BookSortField,
  BookWithReviews,
  CreateBookInput,
  ListBooksQuery,
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

/** Case- and accent-insensitive comparison key. */
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
 * `GET /api/books`
 *
 * Filters are ANDed together. `genre` and `year` are exact matches (a genre picker
 * in the UI sends an exact value); `author` is a substring match, because
 * `"David Thomas, Andrew Hunt"` should be findable by searching `"hunt"`.
 */
export async function listBooks(query: ListBooksQuery): Promise<ApiListResponse<Book>> {
  const all = await booksRepository.findAll();

  const filtered = all.filter((book) => {
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
  });

  const sorted = [...filtered].sort((a, b) =>
    applyOrder(compareBooks(a, b, query.sort), query.order),
  );

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  const offset = (query.page - 1) * query.limit;

  return {
    data: sorted.slice(offset, offset + query.limit),
    meta: { total, page: query.page, limit: query.limit, totalPages },
  };
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

### `apps/api/src/data/books.repository.ts`

```ts
import type { Book, NewBook } from '@bookshelf/shared';

import { ConflictError } from '../errors';
import { mutateCollection, readCollection } from './jsonStore';

const COLLECTION = 'books';

/**
 * Repository = the only place in the codebase that knows books live in a JSON
 * array. Swap this file for a Postgres or Mongo implementation on Day 3 and
 * nothing above it has to change. That is the entire point of the layer.
 */

export function findAll(): Promise<Book[]> {
  return readCollection<Book>(COLLECTION);
}

export async function findById(id: string): Promise<Book | undefined> {
  const books = await findAll();
  return books.find((book) => book.id === id);
}

/**
 * Ids are sequential and human-readable (`book_031`) to match the spec's seed
 * data, rather than UUIDs.
 *
 * Note the failure mode this creates: ids are derived from the *current contents*
 * of the file, so generating one outside the collection lock would race. That is
 * why this is called from inside `mutateCollection` below and nowhere else.
 */
function nextBookId(books: Book[]): string {
  const highest = books.reduce((max, book) => {
    const match = /^book_(\d+)$/.exec(book.id);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);

  return `book_${String(highest + 1).padStart(3, '0')}`;
}

/**
 * Inserts a book and returns the persisted record.
 *
 * The duplicate-ISBN check lives here rather than in the service layer on purpose:
 * checking in the service would mean read (service) → check → write (repository),
 * and two simultaneous requests could both pass the check before either wrote.
 * Inside the mutator, check and write are one atomic step.
 */
export function create(input: NewBook): Promise<Book> {
  return mutateCollection<Book, Book>(COLLECTION, (books) => {
    if (input.isbn !== null && books.some((book) => book.isbn === input.isbn)) {
      throw new ConflictError(`A book with ISBN ${input.isbn} already exists`, {
        isbn: input.isbn,
      });
    }

    const book: Book = {
      id: nextBookId(books),
      ...input,
      addedAt: new Date().toISOString(),
    };

    return { items: [...books, book], result: book };
  });
}
```

### `apps/api/src/middleware/validate.ts`

```ts
import type { TypeOf, ZodError, ZodTypeAny } from 'zod';

import { ValidationError } from '../errors';

/**
 * Runs a Zod schema and either returns the parsed value or throws a
 * `ValidationError` that the central error handler turns into a 400.
 *
 * `safeParse` is used rather than `parse` so the raw `ZodError` never escapes this
 * module — the API's error contract stays ours, not Zod's.
 *
 * The return type is `TypeOf<S>`, i.e. the schema's *output* type. That matters:
 * after parsing, `.default()`ed fields are guaranteed present and coerced fields are
 * real numbers, so downstream code has no optional-chaining noise.
 */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): TypeOf<S> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError('Request validation failed', formatIssues(result.error));
  }

  return result.data;
}

export interface FieldIssue {
  /** Dotted path to the offending field, e.g. `year` or `authors.0.name`. */
  field: string;
  message: string;
  code: string;
}

function formatIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
    code: issue.code,
  }));
}
```

### `apps/api/src/errors.ts`

```ts
import type { ApiErrorCode } from '@bookshelf/shared';

/**
 * Base class for errors we *intend* to send to the client.
 *
 * The distinction matters: anything that is an `AppError` is a known, expected
 * failure and its message is safe to expose. Anything else that reaches the error
 * handler is a bug, gets logged, and is reported to the client as a generic 500 so
 * we never leak stack traces or file paths.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    // Keeps `instanceof` working when targeting ES2022 classes.
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
```

## 3. CONVENTIONS

Non-negotiable, because the rest of the codebase already follows them:

- **Response envelope.** Every success is `{ data: ... }`, optionally with a sibling
  `meta`. Every failure is `{ error: { code, message, details? } }`. Never return a
  bare array.
- **Layering.** `routes → services → repositories → jsonStore`. A route never touches
  a file; a service never imports `express`. Each layer only calls the one below it.
- **Validation.** Query strings and bodies are validated with a Zod schema that lives
  in `packages/shared`, applied via `parseOrThrow(schema, value)` in the route. Types
  are *derived* from schemas with `z.infer` — never declared separately.
- **Errors.** Throw `NotFoundError` / `ValidationError` / `ConflictError` from
  `../errors`. Do not set status codes in services and do not `try/catch` in routes —
  Express 5 forwards rejected promises to the central error handler automatically.
- **`req.query` values are strings.** Numeric query params need `z.coerce.number()`.
- **No new npm dependencies.** No search library, no Fuse.js, no Lunr, no database.
- **ESM.** `import`/`export` only, no `require`.
- **TypeScript strict** is on. No `any`.

## 4. SPECIFIC TASK + CONSTRAINTS

Add `GET /api/books/search?q=<term>`.

Requirements:
1. Searches across **title, author, and genre**.
2. **Case-insensitive** — `?q=DUNE`, `?q=dune` and `?q=Dune` must return the same hits.
3. Partial/substring matching — `?q=prag` finds *The Pragmatic Programmer*.
4. A missing or empty `q` is a **400 VALIDATION_ERROR**, not an empty result set and
   not a 500.
5. Returns the standard envelope: `{ data: Book[], meta: { ... } }`.

Constraints:
- **Route registration order matters.** `GET /api/books/:id` already exists and `:id`
  will match the literal string `"search"`. Register `/search` so this cannot happen,
  and say in a comment why.
- Put the query schema in `packages/shared/src/book.ts` next to
  `listBooksQuerySchema`, following the same pattern.
- Put the matching logic in `books.service.ts` as an exported async function. The route
  stays thin: validate → call service → `res.json(...)`.
- Read data through `booksRepository.findAll()`. Do not read the JSON file directly.
- In-memory filtering over ~30 records is correct here. Do not add an index or a
  dependency.

Deliverable: the complete contents of each file you change or add, with the file path
above each block, and nothing that would not compile under `strict`.
