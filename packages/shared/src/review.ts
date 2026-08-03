import { z } from 'zod';

export const reviewSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  userId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  createdAt: z.string(),
});

export type Review = z.infer<typeof reviewSchema>;

/**
 * Not wired up on Day 1 — the reviews endpoints land on Day 4. Defined here so
 * the shape is agreed up front and `GET /api/books/:id` can embed reviews today.
 */
export const createReviewSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  rating: z.number().int().min(1, 'rating must be 1-5').max(5, 'rating must be 1-5'),
  text: z.string().trim().min(1, 'text is required').max(4000),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
