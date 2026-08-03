import type { Review } from '@bookshelf/shared';

import { readCollection } from './jsonStore';

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
