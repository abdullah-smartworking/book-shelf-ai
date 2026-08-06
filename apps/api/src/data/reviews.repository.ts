import type { CreateReviewInput, Review } from '@bookshelf/shared';

import { mutateCollection, readCollection } from './jsonStore';

const COLLECTION = 'reviews';

export function findAll(): Promise<Review[]> {
  return readCollection<Review>(COLLECTION);
}

/** Reviews for one book, newest first. */
export async function findByBookId(bookId: string): Promise<Review[]> {
  const reviews = await findAll();
  return reviews
    .filter((review) => review.bookId === bookId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Mirrors `nextBookId` in books.repository.ts — same scheme, `review_NNN`. */
function nextReviewId(reviews: Review[]): string {
  const highest = reviews.reduce((max, review) => {
    const match = /^review_(\d+)$/.exec(review.id);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);

  return `review_${String(highest + 1).padStart(3, '0')}`;
}

/**
 * Inserts a review under `bookId` and returns the persisted record. Unlike
 * `books.repository.create`'s ISBN check, there is no uniqueness invariant here — a
 * user can leave more than one review — so id generation is the only reason this
 * needs to run inside the mutator rather than a plain read-then-write.
 */
export function create(bookId: string, input: CreateReviewInput): Promise<Review> {
  return mutateCollection<Review, Review>(COLLECTION, (reviews) => {
    const review: Review = {
      id: nextReviewId(reviews),
      bookId,
      userId: input.userId,
      rating: input.rating,
      text: input.text,
      createdAt: new Date().toISOString(),
    };

    return { items: [...reviews, review], result: review };
  });
}
