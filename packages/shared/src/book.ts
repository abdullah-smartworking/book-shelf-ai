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

/**
 * Validation schema for `PUT /api/books/:id`.
 *
 * Deliberately NOT `createBookSchema.partial()`: several fields there carry
 * `.default(...)`, and Zod applies a field's default whenever the key is absent —
 * so a partial() version would silently reset an omitted `description`/`isbn`/
 * `coverUrl` to its create-time default instead of leaving it unchanged. Every
 * field here is optional with no default, so "omitted" means "don't touch it."
 * The `.refine` rejects an empty body — a PUT with nothing to change is a no-op
 * the client almost certainly didn't intend.
 */
export const updateBookSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(300).optional(),
    author: z.string().trim().min(1, 'author is required').max(200).optional(),
    genre: z.string().trim().min(1, 'genre is required').max(100).optional(),
    year: z
      .number({ invalid_type_error: 'year must be a number' })
      .int('year must be a whole number')
      .min(EARLIEST_ACCEPTED_YEAR, `year must be ${EARLIEST_ACCEPTED_YEAR} or later`)
      .max(LATEST_ACCEPTED_YEAR, `year must be ${LATEST_ACCEPTED_YEAR} or earlier`)
      .optional(),
    isbn: z.string().trim().min(10, 'isbn looks too short').max(20).nullable().optional(),
    description: z.string().trim().max(2000).optional(),
    coverUrl: z.string().url('coverUrl must be a valid URL').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'at least one field must be provided' });

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

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

/** Validation schema for the `GET /api/books/search` query string. */
export const searchBooksQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required — pass a search term, e.g. /api/books/search?q=dune'),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});

export type SearchBooksQuery = z.infer<typeof searchBooksQuerySchema>;
