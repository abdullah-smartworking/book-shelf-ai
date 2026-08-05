/**
 * Round-agnostic acceptance suite for the Context Showdown.
 *
 * Written from the five requirements stated in the exercise brief, NOT from either
 * round's output — so it is a fair, fixed yardstick. Dropped into
 * `apps/api/tests/` of a candidate tree and run with `tsx --test`.
 *
 * Requirements under test:
 *   1. searches title, author AND genre
 *   2. case-insensitive
 *   3. partial / substring matching
 *   4. missing or empty q  → 400 VALIDATION_ERROR
 *   5. standard { data, meta } envelope
 *   + route order: /search must not be swallowed by /:id
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

let baseUrl: string;
let close: () => Promise<void>;
let dataDir: string;

const BOOKS = [
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
    description: 'Feudal politics on a desert planet.',
    coverUrl: null,
    addedAt: '2025-01-16T10:30:00Z',
  },
  {
    id: 'book_003',
    title: 'The Remains of the Day',
    author: 'Kazuo Ishiguro',
    genre: 'Literary Fiction',
    year: 1989,
    isbn: '978-0679731726',
    description: 'A butler reflects on his service.',
    coverUrl: null,
    addedAt: '2025-01-17T10:30:00Z',
  },
];

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'showdown-'));
  await fs.writeFile(path.join(dataDir, 'books.json'), JSON.stringify(BOOKS, null, 2));
  await fs.writeFile(path.join(dataDir, 'reviews.json'), '[]');
  await fs.writeFile(path.join(dataDir, 'shelves.json'), '[]');
  process.env.BOOKSHELF_DATA_DIR = dataDir;

  const { createApp } = await import('../src/app.js');
  const server = (createApp() as unknown as { listen: Function }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
  close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
});

after(async () => {
  await close?.();
  await fs.rm(dataDir, { recursive: true, force: true });
});

async function search(query: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/api/books/search${query}`);
  return { status: response.status, body: await response.json() };
}

/** Every id in the payload, whatever the envelope is called. */
function ids(body: any): string[] {
  const list = body?.data ?? body?.items ?? body?.results ?? body;
  return Array.isArray(list) ? list.map((b: any) => b.id) : [];
}

describe('REQ-1 searches title, author and genre', () => {
  it('matches on title', async () => {
    const { status, body } = await search('?q=Dune');
    assert.equal(status, 200);
    assert.deepEqual(ids(body), ['book_002']);
  });

  it('matches on author', async () => {
    const { status, body } = await search('?q=Ishiguro');
    assert.equal(status, 200);
    assert.deepEqual(ids(body), ['book_003']);
  });

  it('matches on genre', async () => {
    const { status, body } = await search('?q=Technology');
    assert.equal(status, 200);
    assert.deepEqual(ids(body), ['book_001']);
  });
});

describe('REQ-2 case-insensitive', () => {
  it('?q=DUNE, ?q=dune and ?q=Dune agree', async () => {
    const upper = await search('?q=DUNE');
    const lower = await search('?q=dune');
    const mixed = await search('?q=Dune');
    assert.equal(upper.status, 200);
    assert.deepEqual(ids(upper.body), ['book_002']);
    assert.deepEqual(ids(lower.body), ids(upper.body));
    assert.deepEqual(ids(mixed.body), ids(upper.body));
  });

  it('is case-insensitive on author too', async () => {
    const { body } = await search('?q=ISHIGURO');
    assert.deepEqual(ids(body), ['book_003']);
  });
});

describe('REQ-3 partial / substring matching', () => {
  it('?q=prag finds The Pragmatic Programmer', async () => {
    const { status, body } = await search('?q=prag');
    assert.equal(status, 200);
    assert.deepEqual(ids(body), ['book_001']);
  });

  it('?q=fiction matches both fiction genres', async () => {
    const { body } = await search('?q=fiction');
    assert.deepEqual(ids(body).sort(), ['book_002', 'book_003']);
  });
});

describe('REQ-4 missing or empty q is a 400 VALIDATION_ERROR', () => {
  it('no q at all → 400', async () => {
    const { status, body } = await search('');
    assert.equal(status, 400);
    assert.equal(body?.error?.code, 'VALIDATION_ERROR');
  });

  it('empty q → 400', async () => {
    const { status, body } = await search('?q=');
    assert.equal(status, 400);
    assert.equal(body?.error?.code, 'VALIDATION_ERROR');
  });

  it('whitespace-only q → 400', async () => {
    const { status } = await search('?q=%20%20');
    assert.equal(status, 400);
  });
});

describe('REQ-5 standard { data, meta } envelope', () => {
  it('wraps hits in data, not a bare array', async () => {
    const { body } = await search('?q=dune');
    assert.ok(!Array.isArray(body), 'response must not be a bare array');
    assert.ok(Array.isArray(body.data), 'response.data must be an array');
  });

  it('carries a meta object', async () => {
    const { body } = await search('?q=dune');
    assert.equal(typeof body.meta, 'object');
    assert.notEqual(body.meta, null);
    assert.equal(typeof body.meta.total, 'number');
  });

  it('reports zero hits as an empty data array, not a 404', async () => {
    const { status, body } = await search('?q=zzzznothingmatches');
    assert.equal(status, 200);
    assert.deepEqual(ids(body), []);
    assert.equal(body.meta.total, 0);
  });
});

describe('ROUTE ORDER /search is not swallowed by /:id', () => {
  it('does not 404 with a "no book found with id search" style error', async () => {
    const { status, body } = await search('?q=dune');
    assert.equal(
      status,
      200,
      `got ${status}: ${JSON.stringify(body)} — /search is probably registered after /:id`,
    );
    assert.notEqual(body?.error?.code, 'NOT_FOUND');
  });

  it('GET /api/books/:id still works for a real id', async () => {
    const response = await fetch(`${baseUrl}/api/books/book_002`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.equal(body.data.title, 'Dune');
  });
});
