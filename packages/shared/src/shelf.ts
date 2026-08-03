import { z } from 'zod';

export const shelfSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  bookIds: z.array(z.string()),
  createdAt: z.string(),
});

export type Shelf = z.infer<typeof shelfSchema>;

/** Not wired up on Day 1 — shelves endpoints are later in the week. */
export const createShelfSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  name: z.string().trim().min(1, 'name is required').max(120),
  bookIds: z.array(z.string()).optional().default([]),
});

export type CreateShelfInput = z.infer<typeof createShelfSchema>;
