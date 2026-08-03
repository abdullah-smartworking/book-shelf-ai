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
