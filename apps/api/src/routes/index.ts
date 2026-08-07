import { Router } from 'express';

import { booksRouter } from './books.routes';
import { listsRouter } from './lists.routes';
import { usersRouter } from './users.routes';

/**
 * Single mounting point for everything under `/api`.
 *
 * Reviews nest directly onto `booksRouter` (see `/:id/reviews` there) — no change
 * needed here for that. Adding `/api/shelves` later is still a one-line change here
 * rather than a change in `app.ts`.
 */
export const apiRouter = Router();

apiRouter.use('/books', booksRouter);
apiRouter.use('/lists', listsRouter);
apiRouter.use('/users', usersRouter);
