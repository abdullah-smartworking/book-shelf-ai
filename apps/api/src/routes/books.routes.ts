import { Router } from 'express';

import {
  createBookSchema,
  listBooksQuerySchema,
  searchBooksQuerySchema,
} from '@bookshelf/shared';

import { parseOrThrow } from '../middleware/validate';
import * as booksService from '../services/books.service';

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
