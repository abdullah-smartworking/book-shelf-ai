import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, Review, User, UserWithStats } from '@bookshelf/shared';

/**
 * Same isolation pattern as books.test.ts / reviews.test.ts: a throwaway temp
 * data dir, and a dynamic `import('../src/app')` issued after
 * BOOKSHELF_DATA_DIR is set (a static import would be hoisted before
 * config.ts reads the env var).
 */

const SEED_USERS: User[] = [
  {
    id: 'user_001',
    displayName: 'Ada Lovelace',
    avatarUrl: null,
    favouriteGenres: ['Science Fiction', 'Mathematics'],
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user_002',
    displayName: 'Grace Hopper',
    avatarUrl: 'https://example.com/grace.png',
    favouriteGenres: ['Technology'],
    createdAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'user_003',
    displayName: 'Zero Reviews',
    avatarUrl: null,
    favouriteGenres: [],
    createdAt: '2025-01-03T00:00:00Z',
  },
  {
    id: 'user_004',
    displayName: 'Delete Target',
    avatarUrl: null,
    favouriteGenres: [],
    createdAt: '2025-01-04T00:00:00Z',
  },
];

/**
 * user_001 gets three reviews with out-of-order createdAt timestamps, so the
 * newest-first sort in `getUserActivity` actually has something to prove, and
 * an average (4 + 5 + 5) / 3 = 4.6666... that only comes out right if the
 * service's one-decimal rounding is exercised (4.7, not 4.67 or 4).
 * user_002 gets a single review (average with no rounding ambiguity: 3).
 * user_003 and user_004 are seeded with zero reviews on purpose.
 */
const SEED_REVIEWS: Review[] = [
  {
    id: 'review_001',
    bookId: 'book_001',
    userId: 'user_001',
    rating: 4,
    text: 'Good read.',
    createdAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'review_002',
    bookId: 'book_002',
    userId: 'user_001',
    rating: 5,
    text: 'Loved it.',
    createdAt: '2025-01-20T10:00:00Z',
  },
  {
    id: 'review_003',
    bookId: 'book_001',
    userId: 'user_001',
    rating: 5,
    text: 'Reread, still great.',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'review_004',
    bookId: 'book_003',
    userId: 'user_002',
    rating: 3,
    text: 'Okay.',
    createdAt: '2025-01-12T10:00:00Z',
  },
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
const usersFile = path.join(dataDir, 'users.json');

await fs.writeFile(usersFile, JSON.stringify(SEED_USERS, null, 2), 'utf8');
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

/** Reads users.json straight off disk — proves persistence, not just the response. */
async function readUsersFile(): Promise<User[]> {
  return JSON.parse(await fs.readFile(usersFile, 'utf8')) as User[];
}

describe('POST /api/users', () => {
  it('creates a profile with defaults when avatarUrl/favouriteGenres are omitted', async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'New User' }),
    });
    const body = (await response.json()) as { data: User };

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('location'), `/api/users/${body.data.id}`);
    assert.equal(body.data.id, 'user_005', 'id should continue the sequence after the four seeded users');
    assert.equal(body.data.displayName, 'New User');
    assert.equal(body.data.avatarUrl, null, 'avatarUrl defaults to null when omitted');
    assert.deepEqual(body.data.favouriteGenres, [], 'favouriteGenres defaults to [] when omitted');
    assert.ok(body.data.createdAt, 'server must stamp createdAt');

    const onDisk = await readUsersFile();
    assert.ok(onDisk.some((user) => user.id === 'user_005'), 'must persist to disk');
  });

  it('creates a profile with explicit avatarUrl and favouriteGenres', async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Full User',
        avatarUrl: 'https://example.com/full.png',
        favouriteGenres: ['Fantasy', 'Horror'],
      }),
    });
    const body = (await response.json()) as { data: User };

    assert.equal(response.status, 201);
    assert.equal(body.data.id, 'user_006', 'id should continue the sequence');
    assert.equal(body.data.avatarUrl, 'https://example.com/full.png');
    assert.deepEqual(body.data.favouriteGenres, ['Fantasy', 'Horror']);
  });

  it('rejects a missing displayName', async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favouriteGenres: ['Fiction'] }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects an empty (whitespace-only) displayName', async () => {
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: '   ' }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/users', () => {
  it('lists all profiles, including the four seeded and two just created', async () => {
    const response = await fetch(`${baseUrl}/api/users`);
    const body = (await response.json()) as { data: User[] };

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 6);
    for (const id of ['user_001', 'user_002', 'user_003', 'user_004', 'user_005', 'user_006']) {
      assert.ok(
        body.data.some((user) => user.id === id),
        `expected ${id} in the list`,
      );
    }
  });
});

describe('GET /api/users/:id', () => {
  it('embeds computed stats for a user with multiple reviews, rounded to one decimal', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_001`);
    const body = (await response.json()) as { data: UserWithStats };

    assert.equal(response.status, 200);
    assert.equal(body.data.id, 'user_001');
    assert.equal(body.data.stats.reviewCount, 3);
    // (4 + 5 + 5) / 3 = 4.6666... -> rounds to 4.7, not 4.67 or 4.
    assert.equal(body.data.stats.averageRatingGiven, 4.7);
  });

  it('embeds stats for a user with exactly one review', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_002`);
    const body = (await response.json()) as { data: UserWithStats };

    assert.equal(response.status, 200);
    assert.equal(body.data.stats.reviewCount, 1);
    assert.equal(body.data.stats.averageRatingGiven, 3);
  });

  it('returns reviewCount 0 and averageRatingGiven null for a user with zero reviews', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_003`);
    const body = (await response.json()) as { data: UserWithStats };

    assert.equal(response.status, 200);
    assert.equal(body.data.stats.reviewCount, 0);
    assert.equal(body.data.stats.averageRatingGiven, null);
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_999`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('PUT /api/users/:id', () => {
  it('updates only the fields present in the body, leaving others untouched', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_002`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatarUrl: 'https://example.com/grace-new.png' }),
    });
    const body = (await response.json()) as { data: User };

    assert.equal(response.status, 200);
    assert.equal(body.data.avatarUrl, 'https://example.com/grace-new.png', 'the supplied field changed');
    assert.equal(body.data.displayName, 'Grace Hopper', 'omitted field survives untouched');
    assert.deepEqual(body.data.favouriteGenres, ['Technology'], 'omitted field survives untouched');

    const onDisk = await readUsersFile();
    const persisted = onDisk.find((user) => user.id === 'user_002');
    assert.equal(persisted?.avatarUrl, 'https://example.com/grace-new.png');
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_999`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Nobody' }),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('rejects an empty body — the schema requires at least one field', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_002`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes an existing profile and returns 204 with no body', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_004`, { method: 'DELETE' });

    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');

    const onDisk = await readUsersFile();
    assert.ok(!onDisk.some((user) => user.id === 'user_004'), 'profile must be gone from disk');
  });

  it('returns 404 NOT_FOUND deleting the same profile again', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_004`, { method: 'DELETE' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for an id that never existed', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_999`, { method: 'DELETE' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('GET /api/users/:id/activity', () => {
  it("returns this user's reviews newest first", async () => {
    const response = await fetch(`${baseUrl}/api/users/user_001/activity`);
    const body = (await response.json()) as { data: Review[] };

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.data.map((review) => review.id),
      ['review_002', 'review_003', 'review_001'],
      'newest createdAt (2025-01-20) first, oldest (2025-01-10) last',
    );
  });

  it('returns an empty array (not a 404) for a user who exists but has never reviewed anything', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_003/activity`);
    const body = (await response.json()) as { data: Review[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
  });

  it('returns 404 NOT_FOUND for an unknown user id', async () => {
    const response = await fetch(`${baseUrl}/api/users/user_999/activity`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
