import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiListResponse, ApiSearchResponse, Book } from '@bookshelf/shared';

/**
 * Integration tests over real HTTP, using Node's built-in test runner and `fetch`.
 * No jest, no vitest, no supertest — nothing to install, nothing to configure.
 *
 * Two setup details that are easy to get wrong:
 *
 *  1. **The data directory is a throwaway temp dir.** `POST` tests genuinely write
 *     to disk, so pointing at the real `data/` would mean the test suite silently
 *     appends junk to the seed catalogue on every run.
 *
 *  2. **`config.ts` reads `process.env` at import time**, so the env var must be set
 *     *before* the app module is imported. Static `import` statements are hoisted
 *     and would run too early, hence the dynamic `await import()` below.
 */

const SEED_BOOKS: Book[] = [
  {
    id: 'book_001',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas, Andrew Hunt',
    genre: 'Technology',
    year: 1999,
    isbn: '978-0135957059',
    // The word "science" here only exists so the ranking test below has a
    // description-only match to compare a genre match against.
    description: 'A guide to software craftsmanship, not a computer science textbook.',
    coverUrl: null,
    addedAt: '2025-01-15T10:30:00Z',
  },
  {
    id: 'book_002',
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Science Fiction',
    year: 1965,
    isbn: '978-0441013593',
    description: 'Desert planet, giant worms, galactic politics.',
    coverUrl: null,
    addedAt: '2025-01-18T08:00:00Z',
  },
  {
    id: 'book_003',
    title: 'Neuromancer',
    author: 'William Gibson',
    genre: 'Science Fiction',
    year: 1984,
    isbn: '978-0441569595',
    description: 'A console cowboy takes one last job.',
    coverUrl: null,
    addedAt: '2025-01-18T08:05:00Z',
  },
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
const booksFile = path.join(dataDir, 'books.json');

await fs.writeFile(booksFile, JSON.stringify(SEED_BOOKS, null, 2), 'utf8');
await fs.writeFile(
  path.join(dataDir, 'reviews.json'),
  JSON.stringify(
    [
      {
        id: 'review_001',
        bookId: 'book_001',
        userId: 'user_001',
        rating: 5,
        text: 'Essential reading.',
        createdAt: '2025-01-20T14:00:00Z',
      },
    ],
    null,
    2,
  ),
  'utf8',
);

process.env.BOOKSHELF_DATA_DIR = dataDir;

const { createApp } = await import('../src/app');

const server = createApp().listen(0);
await once(server, 'listening');
const { port } = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${port}`;

after(async () => {
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

/** Reads books.json straight off disk — proves persistence, not just the response. */
async function readBooksFile(): Promise<Book[]> {
  return JSON.parse(await fs.readFile(booksFile, 'utf8')) as Book[];
}

describe('GET /api/books', () => {
  it('returns all seeded books in the standard envelope', async () => {
    const response = await fetch(`${baseUrl}/api/books`);
    const body = (await response.json()) as ApiListResponse<Book>;

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 3);
    assert.equal(body.meta.total, 3);
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.totalPages, 1);
  });

  it('filters by genre, case-insensitively', async () => {
    const response = await fetch(`${baseUrl}/api/books?genre=science%20fiction`);
    const body = (await response.json()) as ApiListResponse<Book>;

    assert.equal(body.meta.total, 2);
    assert.ok(body.data.every((book) => book.genre === 'Science Fiction'));
  });

  it('finds a co-author by substring', async () => {
    const response = await fetch(`${baseUrl}/api/books?author=hunt`);
    const body = (await response.json()) as ApiListResponse<Book>;

    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0]?.id, 'book_001');
  });

  it('sorts and paginates', async () => {
    const response = await fetch(`${baseUrl}/api/books?sort=year&order=asc&limit=2&page=1`);
    const body = (await response.json()) as ApiListResponse<Book>;

    assert.deepEqual(
      body.data.map((book) => book.year),
      [1965, 1984],
    );
    assert.equal(body.meta.totalPages, 2);
  });

  it('rejects a limit above the maximum', async () => {
    const response = await fetch(`${baseUrl}/api/books?limit=9999`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/books/:id', () => {
  it('returns one book with its reviews embedded', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001`);
    const body = (await response.json()) as { data: Book & { reviews: unknown[] } };

    assert.equal(response.status, 200);
    assert.equal(body.data.title, 'The Pragmatic Programmer');
    assert.equal(body.data.reviews.length, 1);
  });

  it('returns an empty reviews array rather than omitting the field', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_002`);
    const body = (await response.json()) as { data: { reviews: unknown[] } };

    assert.deepEqual(body.data.reviews, []);
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_999`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('GET /api/books/search', () => {
  // The regression test for the route-ordering bug. If `/:id` were registered
  // first, this returns 404 with code NOT_FOUND instead of a result set.
  it('is not swallowed by the /:id route', async () => {
    const response = await fetch(`${baseUrl}/api/books/search?q=dune`);
    const body = (await response.json()) as ApiSearchResponse;

    assert.equal(response.status, 200);
    assert.equal(body.data[0]?.title, 'Dune');
    assert.deepEqual(body.data[0]?.matchedOn, ['title']);
  });

  it('matches on author as well as title', async () => {
    const body = (await (await fetch(`${baseUrl}/api/books/search?q=gibson`)).json()) as ApiSearchResponse;

    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0]?.id, 'book_003');
    assert.deepEqual(body.data[0]?.matchedOn, ['author']);
  });

  it('ranks a genre match above a description-only match', async () => {
    // "science" hits the genre of the two SF books and the description of book_001.
    const body = (await (await fetch(`${baseUrl}/api/books/search?q=science`)).json()) as ApiSearchResponse;

    assert.equal(body.meta.total, 3);
    assert.deepEqual(body.data[0]?.matchedOn, ['genre']);
    assert.deepEqual(body.data.at(-1)?.matchedOn, ['description']);
  });

  it('requires a q parameter', async () => {
    const response = await fetch(`${baseUrl}/api/books/search`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('POST /api/books', () => {
  it('creates a book, persists it to disk, and returns 201 + Location', async () => {
    const response = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'The Left Hand of Darkness',
        author: 'Ursula K. Le Guin',
        genre: 'Science Fiction',
        year: 1969,
        isbn: '978-0441478125',
        description: 'An envoy to an ambisexual world.',
      }),
    });
    const body = (await response.json()) as { data: Book };

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('location'), `/api/books/${body.data.id}`);
    assert.equal(body.data.id, 'book_004', 'id should continue the sequence');
    assert.ok(body.data.addedAt, 'server must stamp addedAt');
    assert.equal(body.data.coverUrl, null, 'omitted optional field defaults to null');

    const onDisk = await readBooksFile();
    assert.equal(onDisk.length, 4);
    assert.ok(onDisk.some((book) => book.id === 'book_004'));
  });

  it('rejects a missing required field with field-level detail', async () => {
    const response = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'Nobody', genre: 'Fiction', year: 2020 }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(JSON.stringify(body.error.details).includes('title'));
  });

  it('ignores client-supplied id and addedAt instead of trusting them', async () => {
    const response = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'book_001',
        addedAt: '1999-01-01T00:00:00Z',
        title: 'Mass Assignment Attempt',
        author: 'Anon',
        genre: 'Fiction',
        year: 2024,
      }),
    });
    const body = (await response.json()) as { data: Book };

    assert.equal(response.status, 201);
    assert.notEqual(body.data.id, 'book_001', 'must not overwrite an existing book');
    assert.notEqual(body.data.addedAt, '1999-01-01T00:00:00Z');
  });

  it('rejects a duplicate ISBN with 409', async () => {
    const response = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Dune (duplicate)',
        author: 'Frank Herbert',
        genre: 'Science Fiction',
        year: 1965,
        isbn: '978-0441013593',
      }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 409);
    assert.equal(body.error.code, 'CONFLICT');
  });

  it('returns 400 INVALID_JSON for a malformed body, not 500', async () => {
    const response = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"title": "unclosed',
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
  });

  // The reason mutateCollection() serialises read-modify-write. Without the lock,
  // these five requests all read the same array and four of the books disappear.
  it('does not lose writes when five books are posted concurrently', async () => {
    const before = (await readBooksFile()).length;

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        fetch(`${baseUrl}/api/books`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: `Concurrent Book ${index}`,
            author: 'Race Condition',
            genre: 'Technology',
            year: 2024,
          }),
        }),
      ),
    );

    assert.ok(responses.every((response) => response.status === 201));

    const after = await readBooksFile();
    assert.equal(after.length, before + 5, 'every concurrent write must survive');

    const ids = new Set(after.map((book) => book.id));
    assert.equal(ids.size, after.length, 'every id must be unique');
  });
});

describe('unmatched routes', () => {
  it('returns a JSON 404 rather than Express HTML', async () => {
    const response = await fetch(`${baseUrl}/api/nope`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  });
});

describe('GET /health', () => {
  it('reports ok', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as { status: string };

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
  });
});
