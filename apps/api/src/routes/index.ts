import { Router } from 'express';

import { booksRouter } from './books.routes';

/**
 * Single mounting point for everything under `/api`.
 *
 * Adding `/api/shelves` and `/api/books/:id/reviews` later in the week is a
 * one-line change here rather than a change in `app.ts`.
 */
export const apiRouter = Router();

apiRouter.use('/books', booksRouter);
