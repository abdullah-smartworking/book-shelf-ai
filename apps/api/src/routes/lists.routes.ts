import { Router } from 'express';

import { createListSchema, updateListBooksSchema } from '@bookshelf/shared';

import { parseOrThrow } from '../middleware/validate';
import * as listsService from '../services/lists.service';

/**
 * Route layer = HTTP only. See `books.routes.ts` for the fuller explanation of the
 * "no try/catch, no asyncHandler" rule — Express 5 forwards rejected promises from
 * async handlers to the error middleware on its own.
 */
export const listsRouter = Router();

/** `GET /api/lists` — no pagination; lists are expected to stay small. */
listsRouter.get('/', async (req, res) => {
  const lists = await listsService.listLists();
  res.json({ data: lists });
});

/** `POST /api/lists` — create a list. 201 + Location, same convention as POST /api/books. */
listsRouter.post('/', async (req, res) => {
  const input = parseOrThrow(createListSchema, req.body);
  const list = await listsService.createList(input);
  res.status(201).location(`/api/lists/${list.id}`).json({ data: list });
});

/** `GET /api/lists/:id` — a single list with its books resolved, not just ids. */
listsRouter.get('/:id', async (req, res) => {
  const list = await listsService.getListById(req.params.id);
  res.json({ data: list });
});

/** `PUT /api/lists/:id/books` — add and/or remove book ids from a list's bookIds. */
listsRouter.put('/:id/books', async (req, res) => {
  const input = parseOrThrow(updateListBooksSchema, req.body);
  const list = await listsService.updateListBooks(req.params.id, input);
  res.json({ data: list });
});

/** `DELETE /api/lists/:id` — removes a list. 404 if it never existed. */
listsRouter.delete('/:id', async (req, res) => {
  await listsService.deleteList(req.params.id);
  res.status(204).end();
});
