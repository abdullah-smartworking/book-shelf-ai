import type { CreateReviewInput, Review } from '@bookshelf/shared';

import * as booksRepository from '../data/books.repository';
import * as reviewsRepository from '../data/reviews.repository';
import { NotFoundError } from '../errors';

/**
 * `GET /api/books/:id/reviews`
 *
 * 404s if the book itself doesn't exist — distinguishes "book exists, zero
 * reviews" (empty array) from "no such book", the same distinction
 * `books.service.getBookById` makes for the embedded-reviews case.
 */
export async function listReviewsForBook(bookId: string): Promise<Review[]> {
  const book = await booksRepository.findById(bookId);
  if (book === undefined) {
    throw new NotFoundError(`No book found with id "${bookId}"`, { id: bookId });
  }
  return reviewsRepository.findByBookId(bookId);
}

/**
 * `POST /api/books/:id/reviews`
 *
 * Known limitation, not fixed here: the existence check and the write are two
 * separate operations against two separately-locked collections (books vs
 * reviews — `jsonStore.ts`'s mutex is per-collection). A book deleted between the
 * check and the write would leave an orphaned review. Closing that gap would need
 * a cross-collection lock `jsonStore.ts` doesn't have — out of scope for a
 * JSON-file learning project (see CLAUDE.md "Known Limitations").
 */
export async function createReview(bookId: string, input: CreateReviewInput): Promise<Review> {
  const book = await booksRepository.findById(bookId);
  if (book === undefined) {
    throw new NotFoundError(`No book found with id "${bookId}"`, { id: bookId });
  }
  return reviewsRepository.create(bookId, input);
}
