import type { CreateListInput, List, ListWithBooks, UpdateListBooksInput } from '@bookshelf/shared';

import * as booksRepository from '../data/books.repository';
import * as listsRepository from '../data/lists.repository';
import { NotFoundError, ValidationError } from '../errors';

/**
 * Service layer = business logic. No `req`/`res`, no file access — see
 * `books.service.ts` for the fuller explanation of why that separation matters.
 */

/** `GET /api/lists` */
export function listLists(): Promise<List[]> {
  return listsRepository.findAll();
}

/**
 * `GET /api/lists/:id`
 *
 * Mirrors `books.service.getBookById`'s `Promise.all` pattern: the list and the
 * full book catalogue are independent reads, issued concurrently rather than one
 * after the other.
 *
 * A `bookIds` entry with no matching book (e.g. the book was deleted after being
 * added to this list — `DELETE /api/books/:id` does not cascade into lists, same
 * as it doesn't cascade into shelves; see CLAUDE.md's Known Limitations) is
 * silently dropped from the resolved `books` array rather than surfaced as `null`
 * or an error. The contract doesn't say either way; dropping it keeps `books: Book[]`
 * exactly `Book[]`, with no caller needing to filter or null-check.
 */
export async function getListById(id: string): Promise<ListWithBooks> {
  const [list, books] = await Promise.all([listsRepository.findById(id), booksRepository.findAll()]);

  if (list === undefined) {
    throw new NotFoundError(`No list found with id "${id}"`, { id });
  }

  const booksById = new Map(books.map((book) => [book.id, book] as const));
  const resolvedBooks = list.bookIds
    .map((bookId) => booksById.get(bookId))
    .filter((book): book is NonNullable<typeof book> => book !== undefined);

  return { ...list, books: resolvedBooks };
}

/** `POST /api/lists` */
export function createList(input: CreateListInput): Promise<List> {
  return listsRepository.create(input);
}

/**
 * `PUT /api/lists/:id/books`
 *
 * The book-ids-exist check for `add` reads `booksRepository.findAll()` before the
 * write, not inside `lists.repository.update`'s mutator — that mutator only holds
 * a lock on the `lists` collection, so checking a `books` invariant inside it
 * wouldn't be any more atomic. This mirrors `reviews.service.createReview`'s
 * check-then-write against a different collection, with the same known race: a
 * book deleted between this check and the write would slip through. Acceptable
 * here for the same reason it's acceptable there (see CLAUDE.md's Known
 * Limitations) — closing it needs a cross-collection lock `jsonStore.ts` doesn't
 * have.
 *
 * Skipped entirely when `add` is empty, so a remove-only request never pays for a
 * `books.json` read it doesn't need.
 */
export async function updateListBooks(id: string, input: UpdateListBooksInput): Promise<List> {
  if (input.add.length > 0) {
    const books = await booksRepository.findAll();
    const knownIds = new Set(books.map((book) => book.id));
    const unknown = input.add.filter((bookId) => !knownIds.has(bookId));
    if (unknown.length > 0) {
      throw new ValidationError(`Unknown book id(s) in "add": ${unknown.join(', ')}`, {
        bookIds: unknown,
      });
    }
  }

  const list = await listsRepository.update(id, { add: input.add, remove: input.remove });
  if (list === undefined) {
    throw new NotFoundError(`No list found with id "${id}"`, { id });
  }
  return list;
}

/** `DELETE /api/lists/:id` */
export async function deleteList(id: string): Promise<void> {
  const deleted = await listsRepository.remove(id);
  if (!deleted) {
    throw new NotFoundError(`No list found with id "${id}"`, { id });
  }
}
