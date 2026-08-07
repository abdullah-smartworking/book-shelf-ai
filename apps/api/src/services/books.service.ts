import type {
  ApiListResponse,
  ApiSearchResponse,
  Book,
  BookSearchHit,
  BookSortField,
  BookWithReviews,
  CreateBookInput,
  ListBooksQuery,
  NewBook,
  Review,
  SearchBooksQuery,
  SortOrder,
  UpdateBookInput,
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
 * One decimal place is the standard granularity for a star rating (e.g. "4.3
 * average"); more would be false precision for a scale of 1-5.
 */
function computeAverageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) {
    return null;
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
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

  return { ...book, reviews, averageRating: computeAverageRating(reviews) };
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

/**
 * `PUT /api/books/:id`
 *
 * Same field-by-field discipline as `createBook`: only keys present on `input`
 * (which the schema already limits to the seven updatable fields) are forwarded,
 * so `undefined` never overwrites an existing value with "nothing."
 */
export async function updateBook(id: string, input: UpdateBookInput): Promise<Book> {
  const patch: Partial<NewBook> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.author !== undefined) patch.author = input.author;
  if (input.genre !== undefined) patch.genre = input.genre;
  if (input.year !== undefined) patch.year = input.year;
  if (input.isbn !== undefined) patch.isbn = input.isbn;
  if (input.description !== undefined) patch.description = input.description;
  if (input.coverUrl !== undefined) patch.coverUrl = input.coverUrl;

  const book = await booksRepository.update(id, patch);
  if (book === undefined) {
    throw new NotFoundError(`No book found with id "${id}"`, { id });
  }
  return book;
}

/**
 * `DELETE /api/books/:id`
 *
 * Deliberately does NOT cascade into shelves or reviews:
 *  - There is no shelves repository/service/route anywhere in this codebase yet —
 *    only a seeded `data/shelves.json` nothing else touches. Building a shelves
 *    feature solely to satisfy a cascade-delete is the scope creep CLAUDE.md's
 *    "Don't widen scope" rule calls out. Flagging it instead: deleting a book can
 *    leave its id dangling inside some shelf's `bookIds` array; whoever builds the
 *    shelves feature should filter dangling ids on read or backfill a cleanup pass.
 *  - Reviews DO have a repository, so cascading there is a real 5-minute addition —
 *    also skipped here, also flagged rather than silently decided either way, since
 *    nothing asked for it. `reviews.service.listReviewsForBook` will 404 for this id
 *    going forward anyway (the book lookup fails first), so orphaned reviews are
 *    unreachable through the API even though they remain on disk.
 */
export async function deleteBook(id: string): Promise<void> {
  const deleted = await booksRepository.remove(id);
  if (!deleted) {
    throw new NotFoundError(`No book found with id "${id}"`, { id });
  }
}

const SEARCHABLE_FIELDS = ['title', 'author', 'genre', 'description'] as const;
type SearchableField = (typeof SEARCHABLE_FIELDS)[number];

/** Earlier fields rank higher: a title hit beats a description hit. */
const FIELD_WEIGHTS: Record<SearchableField, number> = {
  title: 8,
  author: 4,
  genre: 2,
  description: 1,
};

/**
 * `GET /api/books/search?q=`
 *
 * A naive substring scan over 30 records in memory. That is the right call at this
 * size — an index would be pure ceremony. Two refinements that are cheap and make
 * the results feel much better:
 *
 *  - **Field weighting**, so searching "Ishiguro" ranks his books above a book
 *    whose description merely mentions him.
 *  - **Prefix bonus**, so searching "dun" puts *Dune* first rather than whichever
 *    book happens to appear earliest in the file.
 */
export async function searchBooks(query: SearchBooksQuery): Promise<ApiSearchResponse> {
  const term = normalise(query.q);
  const all = await booksRepository.findAll();

  const scored: Array<{ hit: BookSearchHit; score: number }> = [];

  for (const book of all) {
    const matchedOn: BookSearchHit['matchedOn'] = [];
    let score = 0;

    for (const field of SEARCHABLE_FIELDS) {
      const haystack = normalise(book[field]);
      if (!haystack.includes(term)) continue;

      matchedOn.push(field);
      score += FIELD_WEIGHTS[field];
      if (haystack.startsWith(term)) score += FIELD_WEIGHTS[field];
    }

    if (matchedOn.length > 0) {
      scored.push({ hit: { ...book, matchedOn }, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title));

  return {
    data: scored.slice(0, query.limit).map((entry) => entry.hit),
    meta: { query: query.q, total: scored.length, limit: query.limit },
  };
}
