import { z } from 'zod';

import type { Book } from './book';

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  bookIds: z.array(z.string()),
  createdAt: z.string(),
});
export type List = z.infer<typeof listSchema>;

export const createListSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  description: z.string().trim().max(500).optional().default(''),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListBooksSchema = z
  .object({
    add: z.array(z.string()).optional().default([]),
    remove: z.array(z.string()).optional().default([]),
  })
  .refine((data) => data.add.length > 0 || data.remove.length > 0, {
    message: 'at least one of add or remove must be non-empty',
  });

/**
 * The validated, ready-to-use shape — what `lists.service.updateListBooks`
 * receives after `parseOrThrow`. `.default([])` means both fields are always
 * present here, never `undefined`.
 */
export type UpdateListBooksInput = z.infer<typeof updateListBooksSchema>;

/**
 * What a caller constructs BEFORE validation — e.g. the frontend sending
 * `{ remove: [id] }` alone. Deliberately `z.input`, not `z.infer` (== `z.output`):
 * `.optional().default([])` makes a field required-but-defaulted in the *parsed*
 * output, but a caller building a request body needs it to stay genuinely
 * optional. This is the first shared type in this codebase used on both sides of
 * that boundary — every other `*Input` type here (`CreateBookInput`,
 * `CreateReviewInput`, ...) only ever gets read post-parse, so the distinction
 * never mattered until now.
 */
export type UpdateListBooksRequest = z.input<typeof updateListBooksSchema>;

/** `GET /api/lists/:id` embeds resolved books, not just ids. */
export interface ListWithBooks extends List {
  books: Book[]; // resolved from bookIds, same order as bookIds
}
