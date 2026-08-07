import type { Book, CreateUserInput, Review, UpdateUserInput, User, UserWithStats } from '@bookshelf/shared';

import * as booksRepository from '../data/books.repository';
import * as reviewsRepository from '../data/reviews.repository';
import * as usersRepository from '../data/users.repository';
import { NotFoundError } from '../errors';

/** A rating at or above this counts as "the user liked this genre." */
const LIKED_RATING_THRESHOLD = 4;

/** Hard cap — 30 books across 10 genres means "all of them" is never useful. */
const MAX_RECOMMENDATIONS = 10;

/**
 * Service layer = business logic. No `req`/`res`, no file access — see
 * `books.service.ts` for the fuller explanation of why that separation matters.
 */

/**
 * One decimal place, `null` when there are no reviews — same reasoning and same
 * duplicated-on-purpose shape as `computeAverageRating` in `books.service.ts`.
 * Extracting a shared helper for four lines isn't worth coupling the two
 * services over; see that file's version for the fuller justification.
 */
function computeAverageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) {
    return null;
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

/** `GET /api/users` */
export function listUsers(): Promise<User[]> {
  return usersRepository.findAll();
}

/**
 * `GET /api/users/:id`
 *
 * Mirrors `books.service.getBookById`'s `Promise.all` pattern: the profile and
 * this user's reviews are independent reads, issued concurrently.
 */
export async function getUserById(id: string): Promise<UserWithStats> {
  const [user, reviews] = await Promise.all([
    usersRepository.findById(id),
    reviewsRepository.findByUserId(id),
  ]);

  if (user === undefined) {
    throw new NotFoundError(`No user found with id "${id}"`, { id });
  }

  return {
    ...user,
    stats: {
      reviewCount: reviews.length,
      averageRatingGiven: computeAverageRating(reviews),
    },
  };
}

/** `POST /api/users` */
export function createUser(input: CreateUserInput): Promise<User> {
  return usersRepository.create(input);
}

/** `PUT /api/users/:id` */
export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const user = await usersRepository.update(id, input);
  if (user === undefined) {
    throw new NotFoundError(`No user found with id "${id}"`, { id });
  }
  return user;
}

/** `DELETE /api/users/:id` */
export async function deleteUser(id: string): Promise<void> {
  const deleted = await usersRepository.remove(id);
  if (!deleted) {
    throw new NotFoundError(`No user found with id "${id}"`, { id });
  }
}

/**
 * `GET /api/users/:id/activity`
 *
 * Recent reviews only. Deliberately does NOT include reading-list activity —
 * the Reading Lists feature (Exercise B) has no `userId` field on `List` at
 * all, so there is nothing to attribute a list update to. Adding user
 * ownership to lists just to fill this out would be a real change to an
 * already-shipped feature, not something this exercise asked for — flagged
 * here rather than silently expanded, same as this project's existing pattern
 * for `DELETE /api/books/:id` not cascading into shelves.
 */
export async function getUserActivity(id: string): Promise<Review[]> {
  const user = await usersRepository.findById(id);
  if (user === undefined) {
    throw new NotFoundError(`No user found with id "${id}"`, { id });
  }
  return reviewsRepository.findByUserId(id);
}

/**
 * `GET /api/users/:id/recommendations`
 *
 * Never recommends a book the user has already reviewed. Ranks by genre
 * match strength, ties broken by most recently added:
 *   - score 2: genre is an explicit `favouriteGenres` entry
 *   - score 1: genre isn't a stated favourite, but the user rated a book in
 *     that genre >= LIKED_RATING_THRESHOLD — inferred interest, ranked below
 *     a stated one on purpose (a user said this explicitly; the other is a guess)
 * A book matching neither is excluded entirely, not scored 0 — there's no
 * signal at all connecting it to this user.
 */
export async function getRecommendationsForUser(id: string): Promise<Book[]> {
  const [user, reviews, books] = await Promise.all([
    usersRepository.findById(id),
    reviewsRepository.findByUserId(id),
    booksRepository.findAll(),
  ]);

  if (user === undefined) {
    throw new NotFoundError(`No user found with id "${id}"`, { id });
  }

  const booksById = new Map(books.map((book) => [book.id, book] as const));
  const reviewedBookIds = new Set(reviews.map((review) => review.bookId));

  const likedGenres = new Set<string>();
  for (const review of reviews) {
    if (review.rating < LIKED_RATING_THRESHOLD) continue;
    const reviewedBook = booksById.get(review.bookId);
    if (reviewedBook !== undefined) likedGenres.add(reviewedBook.genre);
  }
  const favouriteGenres = new Set(user.favouriteGenres);

  const scored: Array<{ book: Book; score: number }> = [];
  for (const book of books) {
    if (reviewedBookIds.has(book.id)) continue;
    if (favouriteGenres.has(book.genre)) {
      scored.push({ book, score: 2 });
    } else if (likedGenres.has(book.genre)) {
      scored.push({ book, score: 1 });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.book.addedAt.localeCompare(a.book.addedAt));

  return scored.slice(0, MAX_RECOMMENDATIONS).map((entry) => entry.book);
}
