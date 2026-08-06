import { Router } from 'express';

import {
  createBookSchema,
  createReviewSchema,
  listBooksQuerySchema,
  searchBooksQuerySchema,
  updateBookSchema,
} from '@bookshelf/shared';

import { parseOrThrow } from '../middleware/validate';
import * as booksService from '../services/books.service';
import * as reviewsService from '../services/reviews.service';

/**
 * Route layer = HTTP only. Its whole job is: validate input, call a service,
 * choose a status code. No business logic, no file access.
 *
 * Note there is no try/catch anywhere below. Express 5 (unlike Express 4)
 * automatically forwards a rejected promise from an async handler to the error
 * middleware. On Express 4 every one of these handlers would need a try/catch or an
 * `asyncHandler` wrapper, and forgetting one produces a silently hanging request.
 * If a tool suggests `asyncHandler` here, it is pattern-matching on Express 4.
 */
export const booksRouter = Router();

/**
 * ⚠️ ORDER IS LOAD-BEARING: `/search` MUST be registered before `/:id`.
 *
 * Express matches routes in registration order, and `/:id` is a wildcard that
 * happily matches the literal string "search". Register them the other way round
 * and `GET /api/books/search?q=dune` returns `404 No book found with id "search"`.
 *
 * This is the single most common bug an AI tool introduces in this file, because
 * generating routes in CRUD order (list, get, create) is the more natural sequence.
 */
booksRouter.get('/search', async (req, res) => {
  const query = parseOrThrow(searchBooksQuerySchema, req.query);
  const results = await booksService.searchBooks(query);
  res.json(results);
});

/** `GET /api/books` — list with optional filters, sorting and pagination. */
booksRouter.get('/', async (req, res) => {
  const query = parseOrThrow(listBooksQuerySchema, req.query);
  const books = await booksService.listBooks(query);
  res.json(books);
});

/** `GET /api/books/:id` — single book with its reviews embedded. */
booksRouter.get('/:id', async (req, res) => {
  const book = await booksService.getBookById(req.params.id);
  res.json({ data: book });
});

/**
 * `POST /api/books` — create a book.
 *
 * 201 Created plus a `Location` header pointing at the new resource is the correct
 * REST response; a bare 200 is the usual AI default and loses information the
 * client would otherwise not have to reconstruct.
 */
booksRouter.post('/', async (req, res) => {
  const input = parseOrThrow(createBookSchema, req.body);
  const book = await booksService.createBook(input);
  res.status(201).location(`/api/books/${book.id}`).json({ data: book });
});

/** `PUT /api/books/:id` — partial update; only fields present in the body change. */
booksRouter.put('/:id', async (req, res) => {
  const input = parseOrThrow(updateBookSchema, req.body);
  const book = await booksService.updateBook(req.params.id, input);
  res.json({ data: book });
});

/** `DELETE /api/books/:id` — removes a book. 404 if it never existed. */
booksRouter.delete('/:id', async (req, res) => {
  await booksService.deleteBook(req.params.id);
  res.status(204).end();
});

/**
 * `GET /api/books/:id/reviews` — reviews for one book, newest first.
 *
 * An extra path segment beyond `/:id`, so this does not collide with the
 * `/search`-before-`/:id` ordering rule above — it's a deeper path, not a
 * sibling of either.
 */
booksRouter.get('/:id/reviews', async (req, res) => {
  const reviews = await reviewsService.listReviewsForBook(req.params.id);
  res.json({ data: reviews });
});

/** `POST /api/books/:id/reviews` — add a review. Same 201 + Location convention as POST /api/books. */
booksRouter.post('/:id/reviews', async (req, res) => {
  const input = parseOrThrow(createReviewSchema, req.body);
  const review = await reviewsService.createReview(req.params.id, input);
  res
    .status(201)
    .location(`/api/books/${req.params.id}/reviews/${review.id}`)
    .json({ data: review });
});
