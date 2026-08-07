import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { ApiErrorResponse, Book } from '@bookshelf/shared';

/**
 * Tests against the Reading Lists API *contract*
 * (`notes/day4-agent-teams/api-contract.md`), not against any particular
 * implementation — the backend agent building `lists.repository.ts` /
 * `lists.service.ts` / `lists.routes.ts` is working in a separate, invisible
 * git worktree in parallel with this one.
 *
 * `packages/shared/src/list.ts` (the contract's `List` / `ListWithBooks` /
 * `CreateListInput` / `UpdateListBooksInput` types) does not exist in *this*
 * worktree at the time this file was written — it's the backend agent's file
 * to add, and its worktree is not visible from here. Rather than block on it,
 * the shapes below are declared locally, matching the contract's Zod schemas
 * field-for-field. If `@bookshelf/shared` grows a real `list.ts` later, these
 * local types can be swapped for imports with no change to the assertions.
 *
 * Same isolation pattern as `reviews.test.ts` / `books.test.ts`: a throwaway
 * temp data dir, and a dynamic `import('../src/app')` issued after
 * `BOOKSHELF_DATA_DIR` is set (a static import would be hoisted before
 * `config.ts` reads the env var).
 */

interface List {
  id: string;
  name: string;
  description: string;
  bookIds: string[];
  createdAt: string;
}

/** `GET /api/lists/:id` embeds resolved books, not just ids, per the contract. */
interface ListWithBooks extends List {
  books: Book[];
}

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
];

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookshelf-test-'));
const listsFile = path.join(dataDir, 'lists.json');

await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(SEED_BOOKS, null, 2), 'utf8');
await fs.writeFile(listsFile, JSON.stringify([], null, 2), 'utf8');

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

/** Reads lists.json straight off disk — proves persistence, not just the response. */
async function readListsFile(): Promise<List[]> {
  return JSON.parse(await fs.readFile(listsFile, 'utf8')) as List[];
}

function postList(body: unknown) {
  return fetch(`${baseUrl}/api/lists`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function putListBooks(id: string, body: unknown) {
  return fetch(`${baseUrl}/api/lists/${id}/books`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/lists', () => {
  it('creates a list, persists it, and returns 201 + Location', async () => {
    const response = await postList({ name: 'Currently Reading', description: 'Books in progress' });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('location'), `/api/lists/${body.data.id}`);
    assert.equal(body.data.id, 'list_001', 'id should follow the list_NNN sequence');
    assert.equal(body.data.name, 'Currently Reading');
    assert.equal(body.data.description, 'Books in progress');
    assert.deepEqual(body.data.bookIds, [], 'a new list starts with no books');
    assert.ok(body.data.createdAt, 'server must stamp createdAt');

    const onDisk = await readListsFile();
    assert.equal(onDisk.length, 1);
    assert.ok(onDisk.some((list) => list.id === 'list_001'));
  });

  it('defaults description to an empty string when omitted', async () => {
    const response = await postList({ name: 'No Description Given' });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 201);
    assert.equal(body.data.id, 'list_002', 'id should continue the sequence');
    assert.equal(body.data.description, '');
  });

  it('rejects an empty name with 400 VALIDATION_ERROR', async () => {
    const response = await postList({ name: '', description: 'A list with no name' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects a missing name with 400 VALIDATION_ERROR', async () => {
    const response = await postList({ description: 'Still no name' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/lists', () => {
  it('returns all lists in the standard envelope, without a meta block', async () => {
    const response = await fetch(`${baseUrl}/api/lists`);
    const body = (await response.json()) as { data: List[]; meta?: unknown };

    assert.equal(response.status, 200);
    // Two lists were created above (list_001, list_002); the empty-name and
    // missing-name attempts must not have persisted anything.
    assert.equal(body.data.length, 2);
    assert.ok(body.data.some((list) => list.id === 'list_001'));
    assert.ok(body.data.some((list) => list.id === 'list_002'));
    // The contract is explicit that list-all has no pagination: "lists are
    // expected to stay small, no pagination needed" — unlike GET /api/books.
    assert.equal(body.meta, undefined, 'list-all has no meta, unlike GET /api/books');
  });
});

describe('GET /api/lists/:id', () => {
  let listId: string;

  it('creates a list and adds two seeded books to it (setup)', async () => {
    const createResponse = await postList({ name: 'Book Club' });
    const createBody = (await createResponse.json()) as { data: List };
    listId = createBody.data.id;

    // Added in reverse catalogue order (Dune, then Pragmatic Programmer) so the
    // resolved-books-order assertion below actually proves something.
    const addDune = await putListBooks(listId, { add: ['book_002'] });
    assert.equal(addDune.status, 200);

    const addPragProg = await putListBooks(listId, { add: ['book_001'] });
    assert.equal(addPragProg.status, 200);
  });

  it('returns the list with books resolved, in bookIds order', async () => {
    const response = await fetch(`${baseUrl}/api/lists/${listId}`);
    const body = (await response.json()) as { data: ListWithBooks };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_002', 'book_001']);
    assert.equal(body.data.books.length, 2);
    assert.equal(body.data.books[0]?.id, 'book_002');
    assert.equal(body.data.books[0]?.title, 'Dune');
    assert.equal(body.data.books[1]?.id, 'book_001');
    assert.equal(body.data.books[1]?.title, 'The Pragmatic Programmer');
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/lists/list_999`);
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('PUT /api/lists/:id/books', () => {
  let listId: string;

  it('creates a scratch list for add/remove scenarios (setup)', async () => {
    const response = await postList({ name: 'Scratch List' });
    const body = (await response.json()) as { data: List };
    listId = body.data.id;

    assert.equal(response.status, 201);
    assert.deepEqual(body.data.bookIds, []);
  });

  it('adds a book id', async () => {
    const response = await putListBooks(listId, { add: ['book_001'] });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_001']);
  });

  it('adding an already-present id is idempotent — no duplicate', async () => {
    const response = await putListBooks(listId, { add: ['book_001'] });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_001'], 'must not duplicate an id already in bookIds');
  });

  it('adds a second, different book id alongside the first', async () => {
    const response = await putListBooks(listId, { add: ['book_002'] });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_001', 'book_002']);
  });

  it('removing an id that is not present is a no-op, not an error', async () => {
    const response = await putListBooks(listId, { remove: ['book_999'] });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_001', 'book_002'], 'nothing should change');
  });

  it('removes a present id', async () => {
    const response = await putListBooks(listId, { remove: ['book_001'] });
    const body = (await response.json()) as { data: List };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.bookIds, ['book_002']);

    const onDisk = await readListsFile();
    assert.deepEqual(onDisk.find((list) => list.id === listId)?.bookIds, ['book_002']);
  });

  it('rejects adding a book id that does not exist in books.json', async () => {
    const response = await putListBooks(listId, { add: ['book_999'] });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');

    // Must not have partially applied — bookIds should be untouched.
    const onDisk = await readListsFile();
    assert.deepEqual(onDisk.find((list) => list.id === listId)?.bookIds, ['book_002']);
  });

  it('rejects a body with neither add nor remove', async () => {
    const response = await putListBooks(listId, {});
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects a body with empty add and remove arrays', async () => {
    const response = await putListBooks(listId, { add: [], remove: [] });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for an unknown list id', async () => {
    const response = await putListBooks('list_999', { add: ['book_001'] });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('DELETE /api/lists/:id', () => {
  let listId: string;

  it('creates a list to delete (setup)', async () => {
    const response = await postList({ name: 'To Delete' });
    const body = (await response.json()) as { data: List };
    listId = body.data.id;

    assert.equal(response.status, 201);
  });

  it('deletes an existing list and returns 204 with no body', async () => {
    const response = await fetch(`${baseUrl}/api/lists/${listId}`, { method: 'DELETE' });

    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');

    const onDisk = await readListsFile();
    assert.ok(!onDisk.some((list) => list.id === listId), 'list must be gone from disk');
  });

  it('returns 404 NOT_FOUND deleting the same list again', async () => {
    const response = await fetch(`${baseUrl}/api/lists/${listId}`, { method: 'DELETE' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for an id that never existed', async () => {
    const response = await fetch(`${baseUrl}/api/lists/list_999`, { method: 'DELETE' });
    const body = (await response.json()) as ApiErrorResponse;

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
