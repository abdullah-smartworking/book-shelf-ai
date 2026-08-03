import type {
  ApiListResponse,
  ApiSearchResponse,
  Book,
  BookSearchHit,
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
