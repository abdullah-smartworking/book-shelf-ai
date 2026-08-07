import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  favouriteGenres: z.array(z.string()),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const createUserSchema = z.object({
  displayName: z.string().trim().min(1, 'displayName is required').max(100),
  avatarUrl: z.string().url('avatarUrl must be a valid URL').nullable().optional().default(null),
  favouriteGenres: z.array(z.string()).optional().default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * No `.default()` on any field, deliberately — same reasoning as
 * `updateBookSchema`. A `.optional().default(...)` field is required-but-defaulted
 * in the *parsed* output type, which breaks the moment a caller (e.g. the frontend)
 * needs to construct a genuinely partial object. That exact mismatch surfaced in
 * the Reading Lists exercise; avoiding `.default()` here sidesteps it rather than
 * needing two separate exported types.
 */
export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1, 'displayName is required').max(100).optional(),
    avatarUrl: z.string().url('avatarUrl must be a valid URL').nullable().optional(),
    favouriteGenres: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'at least one field must be provided' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** `GET /api/users/:id` embeds stats computed from reviews.json, never stored. */
export interface UserStats {
  reviewCount: number;
  averageRatingGiven: number | null;
}
export interface UserWithStats extends User {
  stats: UserStats;
}
