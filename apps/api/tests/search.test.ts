import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiSearchResponse, Book } from '@bookshelf/shared';

/**
 * Additional coverage for `GET /api/books/search`, kept in its own file so it does
 * not collide with the cases already in `books.test.ts` (route-ordering regression,
 * author matches, genre-vs-description ranking, missing `q`). This file covers the
 * edge cases those tests don't: a genuine no-match, explicit case-insensitivity,
 * special/non-ASCII characters in the query, and an empty `q=`.
 *
 * Same setup pattern as `books.test.ts`: real HTTP against a real listening server,
 * an isolated `BOOKSHELF_DATA_DIR` temp dir, and a dynamic `import('../src/app')`
 * *after* the env var is set — `config.ts` reads `process.env` at module-load time,
 * so a static top-level import would be hoisted and run too early.
 */

const SEED_BOOKS: Book[] = [
  {
    id: 'book_001',
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    genre: 'Non-Fiction',
    year: 2011,
    isbn: '978-0062316097',
    description: 'A sweeping look at how homo sapiens conquered the world.',
    coverUrl: null,
    addedAt: '2025-02-01T09:00:00Z',
  },
  {
    id: 'book_002',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    genre: 'Fantasy',
    year: 1937,
    isbn: '978-0345339683',
    description: 'A hobbit is swept into an unexpected journey.',
    coverUrl: null,
    addedAt: '2025-02-01T09:05:00Z',
  },
  {
    id: 'book_003',
    title: 'Educated',
    author: 'Tara Westover',
    genre: 'Memoir',
    year: 2018,
    isbn: '978-0399590504',
    description: 'A memoir about family, isolation, and the power of education.',
    coverUrl: null,
    addedAt: '2025-02-01T09:10:00Z',
  },
  {
    id: 'book_004',
    title: 'Nineteen Eighty-Four',
    author: 'George Orwell',
    genre: 'Dystopian',
    year: 1949,
    isbn: '978-0451524935',
    description: 'A totalitarian regime watches everything its citizens do.',
    coverUrl: null,
    addedAt: '2025-02-01T09:15:00Z',
  },
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-search-test-'));

await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(SEED_BOOKS, null, 2), 'utf8');

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

describe('GET /api/books/search — additional cases', () => {
  it('returns 200 with an empty result set for a genuine no-match, not a 404', async () => {
    const response = await fetch(`${baseUrl}/api/books/search?q=xylophone`);
    const body = (await response.json()) as ApiSearchResponse;

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
    assert.equal(body.meta.total, 0);
  });

  it('matches regardless of case — ALL CAPS', async () => {
    const response = await fetch(`${baseUrl}/api/books/search?q=HOBBIT`);
    const body = (await response.json()) as ApiSearchResponse;

    assert.equal(response.status, 200);
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0]?.id, 'book_002');
  });

  it('matches regardless of case — MiXeD case', async () => {
    const response = await fetch(`${baseUrl}/api/books/search?q=ToLkIeN`);
    const body = (await response.json()) as ApiSearchResponse;

    assert.equal(response.status, 200);
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0]?.id, 'book_002');
    assert.deepEqual(body.data[0]?.matchedOn, ['author']);
  });

  it('does not 500 on regex-special or non-ASCII characters in q', async () => {
    // searchBooks() does a plain String#includes() substring scan (see
    // books.service.ts) — none of these characters are ever compiled as a regex,
    // so nothing here should throw. Whether it matches anything is irrelevant;
    // the only thing under test is "server stays up and returns valid JSON".
    const weirdQueries = ['"quoted"', "it's", '(parens)', 'a.b', 'a*b', 'a+b', 'café', '📚'];

    for (const q of weirdQueries) {
      const response = await fetch(`${baseUrl}/api/books/search?q=${encodeURIComponent(q)}`);
      const body = (await response.json()) as ApiSearchResponse;

      assert.equal(response.status, 200, `query ${JSON.stringify(q)} should not error`);
      assert.ok(Array.isArray(body.data), `query ${JSON.stringify(q)} should return an array`);
      assert.equal(typeof body.meta.total, 'number');
    }
  });

  it('rejects an empty q the same way a missing q is rejected', async () => {
    // searchBooksQuerySchema is `z.string().trim().min(1)`. An empty string still
    // trims to '', which fails min(1) — so `?q=` is rejected with the same
    // VALIDATION_ERROR as omitting `q` entirely, not treated as "match everything".
    const response = await fetch(`${baseUrl}/api/books/search?q=`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});
