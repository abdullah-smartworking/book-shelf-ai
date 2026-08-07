import { Router } from 'express';

import { createUserSchema, updateUserSchema } from '@bookshelf/shared';

import { parseOrThrow } from '../middleware/validate';
import * as usersService from '../services/users.service';

/**
 * Route layer = HTTP only — see `books.routes.ts` for the fuller explanation.
 * No `try/catch`: Express 5 forwards rejected promises to the error middleware.
 */
export const usersRouter = Router();

/** `GET /api/users` — list all profiles. */
usersRouter.get('/', async (_req, res) => {
  const users = await usersService.listUsers();
  res.json({ data: users });
});

/** `GET /api/users/:id` — one profile with computed stats embedded. */
usersRouter.get('/:id', async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  res.json({ data: user });
});

/** `POST /api/users` — create a profile. */
usersRouter.post('/', async (req, res) => {
  const input = parseOrThrow(createUserSchema, req.body);
  const user = await usersService.createUser(input);
  res.status(201).location(`/api/users/${user.id}`).json({ data: user });
});

/** `PUT /api/users/:id` — partial update; only fields present in the body change. */
usersRouter.put('/:id', async (req, res) => {
  const input = parseOrThrow(updateUserSchema, req.body);
  const user = await usersService.updateUser(req.params.id, input);
  res.json({ data: user });
});

/** `DELETE /api/users/:id` — removes a profile. 404 if it never existed. */
usersRouter.delete('/:id', async (req, res) => {
  await usersService.deleteUser(req.params.id);
  res.status(204).end();
});

/**
 * `GET /api/users/:id/activity` — recent reviews by this user, newest first.
 * An extra path segment beyond `/:id`, so no ordering hazard with it.
 */
usersRouter.get('/:id/activity', async (req, res) => {
  const activity = await usersService.getUserActivity(req.params.id);
  res.json({ data: activity });
});
