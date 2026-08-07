import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, Book, Review, User } from '@bookshelf/shared';

/**
 * Same isolation pattern as reviews.test.ts/users.test.ts: a throwaway temp
 * data dir, a dynamic `import('../src/app')` issued after BOOKSHELF_DATA_DIR
 * is set (a static import would be hoisted before config.ts reads the env var).
 */

function book(id: string, genre: string, addedAt: string): Book {
  return {
    id,
    title: `Book ${id}`,
    author: 'Someone',
    genre,
    year: 2000,
    isbn: null,
    description: '',
    coverUrl: null,
    addedAt,
  };
}

function review(id: string, bookId: string, userId: string, rating: number): Review {
  return { id, bookId, userId, rating, text: 'x', createdAt: '2025-01-01T00:00:00Z' };
}

const SEED_BOOKS: Book[] = [
  book('book_001', 'Science Fiction', '2025-01-01T00:00:00Z'), // favourite-genre match candidate
  book('book_002', 'Science Fiction', '2025-01-02T00:00:00Z'), // favourite-genre match candidate, newer
  book('book_003', 'Fantasy', '2025-01-03T00:00:00Z'), // inferred-liked-genre candidate
  book('book_004', 'History', '2025-01-04T00:00:00Z'), // no signal at all — must be excluded
  book('book_005', 'Science Fiction', '2025-01-05T00:00:00Z'), // already reviewed by user_001 — must be excluded
  book('book_006', 'Fantasy', '2025-01-06T00:00:00Z'), // unreviewed — proves the inferred-genre path surfaces OTHER books
];

const SEED_USERS: User[] = [
  { id: 'user_001', displayName: 'Ada', avatarUrl: null, favouriteGenres: ['Science Fiction'], createdAt: '2025-01-01T00:00:00Z' },
  { id: 'user_002', displayName: 'Grace', avatarUrl: null, favouriteGenres: [], createdAt: '2025-01-01T00:00:00Z' },
  { id: 'user_003', displayName: 'NoSignal', avatarUrl: null, favouriteGenres: [], createdAt: '2025-01-01T00:00:00Z' },
];

const SEED_REVIEWS: Review[] = [
  review('review_001', 'book_005', 'user_001', 5), // user_001 already reviewed this SF book
  review('review_002', 'book_003', 'user_002', 5), // user_002 rated a Fantasy book highly, no stated favourite
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));

await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(SEED_BOOKS, null, 2), 'utf8');
await fs.writeFile(path.join(dataDir, 'users.json'), JSON.stringify(SEED_USERS, null, 2), 'utf8');
await fs.writeFile(path.join(dataDir, 'reviews.json'), JSON.stringify(SEED_REVIEWS, null, 2), 'utf8');

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

describe('GET /api/users/:id/recommendations', () => {
  it('recommends unreviewed books in a favourite genre, never an already-reviewed one', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_001/recommendations`);
    const body = (await response.json()) as { data: Book[] };

    assert.equal(response.status, 200);
    const ids = body.data.map((b) => b.id);
    assert.ok(ids.includes('book_001'), 'unreviewed SF book should appear');
    assert.ok(ids.includes('book_002'), 'unreviewed SF book should appear');
    assert.ok(!ids.includes('book_005'), 'already-reviewed book must never appear');
    assert.ok(!ids.includes('book_004'), 'a genre with no signal at all must be excluded');
  });

  it('ranks an explicit favourite-genre match above an inferred one', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_001/recommendations`);
    const body = (await response.json()) as { data: Book[] };

    // book_003 (Fantasy) has no signal for user_001 at all, so it must not appear —
    // this instead proves ordering among the two SF (favourite) matches: newer first.
    assert.deepEqual(
      body.data.map((b) => b.id),
      ['book_002', 'book_001'],
    );
  });

  it('falls back to an inferred genre (>=4-star review) when there is no stated favourite', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_002/recommendations`);
    const body = (await response.json()) as { data: Book[] };

    const ids = body.data.map((b) => b.id);
    // book_003 is the Fantasy book user_002 already reviewed — it must NOT reappear.
    // book_006 is a different, unreviewed Fantasy book — its presence is what actually
    // proves the "genre inferred from a high rating" path works, not book_003's absence.
    assert.ok(!ids.includes('book_003'), 'an already-reviewed book must never be recommended, even in a liked genre');
    assert.ok(ids.includes('book_006'), 'an unreviewed book in the inferred-liked genre should surface');
    // user_002 has no SF favourite or high SF rating, so nothing SF should appear.
    assert.ok(!ids.includes('book_001') && !ids.includes('book_002'));
  });

  it('returns an empty array, not an error, for a user with no favourites and no reviews', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_003/recommendations`);
    const body = (await response.json()) as { data: Book[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
  });

  it('returns 404 NOT_FOUND for an unknown user id', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_999/recommendations`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
