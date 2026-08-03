import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config';

/**
 * Generic access layer over the JSON files in `/data`.
 *
 * This is the whole "database". Every collection is a single JSON file containing
 * a top-level array. Three problems have to be solved, and this file solves each
 * one deliberately:
 *
 *  1. **Torn writes.** If the process dies mid-`writeFile` the file is left as
 *     truncated, unparseable JSON and the dataset is gone. Fix: write to a temp
 *     file, then `rename()` it over the target. On POSIX filesystems rename is
 *     atomic, so a reader sees either the old file or the new one, never a
 *     half-written one.
 *
 *  2. **Lost updates (the read-modify-write race).** Two concurrent POSTs both
 *     read 30 books, both decide the new id is `book_031`, both write 31 books —
 *     and one of the two new books vanishes. Fix: `mutateCollection()` serialises
 *     read+modify+write for a given collection through a promise chain, so the
 *     second request reads the *already updated* array.
 *
 *  3. **Missing / malformed files.** A fresh clone or a hand-edited file should
 *     produce a clear message, not a mystifying crash deep in a route handler.
 *
 * What it deliberately does NOT solve: multi-process safety. Two `node` processes
 * pointed at the same file will still clobber each other, because the lock lives
 * in this process's memory. That needs OS-level file locking or a real database,
 * and it is out of scope for a learning project.
 */

/**
 * One promise chain per collection, acting as an in-process mutex.
 * `writeQueues.get('books')` is "the tail of all book-file work queued so far".
 */
const writeQueues = new Map<string, Promise<unknown>>();

function collectionPath(collection: string): string {
  return path.join(config.dataDir, `${collection}.json`);
}

/** Reads and parses a collection. A missing or empty file is treated as `[]`. */
export async function readCollection<T>(collection: string): Promise<T[]> {
  const file = collectionPath(collection);

  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // First run, or a collection we have not seeded yet. Empty is correct.
      return [];
    }
    throw error;
  }

  if (raw.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Data file ${file} is not valid JSON: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Data file ${file} must contain a JSON array at the top level`);
  }

  return parsed as T[];
}

/** Atomic write: temp file first, then rename over the target. */
async function writeCollectionUnsafe<T>(collection: string, items: T[]): Promise<void> {
  const file = collectionPath(collection);
  const tempFile = `${file}.${randomUUID()}.tmp`;

  await fs.mkdir(path.dirname(file), { recursive: true });
  // Trailing newline keeps the file POSIX-friendly and git diffs clean.
  await fs.writeFile(tempFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');

  try {
    await fs.rename(tempFile, file);
  } catch (error) {
    await fs.rm(tempFile, { force: true }); // don't leave litter behind
    throw error;
  }
}

/**
 * Queues `task` behind any work already pending for `collection`.
 *
 * The `.catch()` on the stored tail is important: without it, one failed write
 * would reject the chain and every subsequent operation on that collection would
 * fail forever. The caller still sees the real rejection via the returned promise.
 */
function enqueue<R>(collection: string, task: () => Promise<R>): Promise<R> {
  const previous = writeQueues.get(collection) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(
    collection,
    next.catch(() => undefined),
  );
  return next;
}

/** Replaces a whole collection. Prefer `mutateCollection` for read-modify-write. */
export function writeCollection<T>(collection: string, items: T[]): Promise<void> {
  return enqueue(collection, () => writeCollectionUnsafe(collection, items));
}

export interface MutationResult<T, R> {
  /** The new contents of the collection. */
  items: T[];
  /** Whatever the caller wants back — usually the created or updated record. */
  result: R;
}

/**
 * Read → transform → write, with the whole sequence held under the collection's
 * lock so no other mutation can interleave.
 *
 * `mutator` receives the current items and returns the replacement array plus a
 * result value. If `mutator` throws (e.g. a `ConflictError` on a duplicate ISBN),
 * nothing is written — the guard and the write share one critical section, which
 * closes the time-of-check-to-time-of-use gap.
 */
export function mutateCollection<T, R>(
  collection: string,
  mutator: (items: T[]) => MutationResult<T, R> | Promise<MutationResult<T, R>>,
): Promise<R> {
  return enqueue(collection, async () => {
    const items = await readCollection<T>(collection);
    const { items: updated, result } = await mutator(items);
    await writeCollectionUnsafe(collection, updated);
    return result;
  });
}
