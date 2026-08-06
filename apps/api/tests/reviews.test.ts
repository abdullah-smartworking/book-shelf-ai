import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, Book, Review } from '@bookshelf/shared';

/**
 * Same isolation pattern as books.test.ts: a throwaway temp data dir, and a
 * dynamic `import('../src/app')` issued after BOOKSHELF_DATA_DIR is set (a
 * static import would be hoisted before config.ts reads the env var).
 */

const SEED_BOOKS: Book[] = [
  {
    id: 'book_001',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas, Andrew Hunt',
    genre: 'Technology',
    year: 1999,
    isbn: '978-0135957059',
    description: 'A guide to software craftsmanship.',
    coverUrl: null,
    addedAt: '2025-01-15T10:30:00Z',
  },
];

const SEED_REVIEWS: Review[] = [
  {
    id: 'review_001',
    bookId: 'book_001',
    userId: 'user_001',
    rating: 5,
    text: 'Essential reading.',
    createdAt: '2025-01-20T14:00:00Z',
  },
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
const reviewsFile = path.join(dataDir, 'reviews.json');

await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(SEED_BOOKS, null, 2), 'utf8');
await fs.writeFile(reviewsFile, JSON.stringify(SEED_REVIEWS, null, 2), 'utf8');

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

/** Reads reviews.json straight off disk — proves persistence, not just the response. */
async function readReviewsFile(): Promise<Review[]> {
  return JSON.parse(await fs.readFile(reviewsFile, 'utf8')) as Review[];
}

describe('GET /api/books/:id/reviews', () => {
  it('returns the seeded review in the standard envelope', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`);
    const body = (await response.json()) as { data: Review[] };

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0]?.id, 'review_001');
  });

  it('returns 404 NOT_FOUND when the book does not exist', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_999/reviews`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('POST /api/books/:id/reviews', () => {
  it('creates a review, persists it, and returns 201 + Location', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user_002', rating: 4, text: 'Solid, practical advice.' }),
    });
    const body = (await response.json()) as { data: Review };

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('location'), `/api/books/book_001/reviews/${body.data.id}`);
    assert.equal(body.data.id, 'review_002', 'id should continue the sequence');
    assert.equal(body.data.bookId, 'book_001');
    assert.ok(body.data.createdAt, 'server must stamp createdAt');

    const onDisk = await readReviewsFile();
    assert.equal(onDisk.length, 2);
    assert.ok(onDisk.some((review) => review.id === 'review_002'));
  });

  it('lists newest-first after the create above', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`);
    const body = (await response.json()) as { data: Review[] };

    assert.equal(body.data.length, 2);
    assert.equal(body.data[0]?.id, 'review_002', 'the just-created review sorts first');
  });

  it('rejects a rating outside 1-5', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user_003', rating: 6, text: 'Too generous a scale.' }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects a missing text field', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user_003', rating: 3 }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND when the book does not exist', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_999/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user_002', rating: 4, text: 'Should not persist.' }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('ignores client-supplied id, bookId, and createdAt', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_001/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'review_001',
        bookId: 'book_999',
        createdAt: '1999-01-01T00:00:00Z',
        userId: 'user_004',
        rating: 2,
        text: 'Mass assignment attempt.',
      }),
    });
    const body = (await response.json()) as { data: Review };

    assert.equal(response.status, 201);
    assert.notEqual(body.data.id, 'review_001', 'must not overwrite an existing review');
    assert.equal(body.data.bookId, 'book_001', 'bookId comes from the URL, not the body');
    assert.notEqual(body.data.createdAt, '1999-01-01T00:00:00Z');
  });
});
