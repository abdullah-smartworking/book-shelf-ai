import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Book, Shelf } from '@bookshelf/shared';

const currentDir = path.dirname(fileURLToPath(import.meta.url)); // apps/mcp-server/src
const repoRoot = path.resolve(currentDir, '..', '..', '..'); // <repo>

/**
 * Same `BOOKSHELF_DATA_DIR` override as `apps/api/src/config.ts`, so this server
 * can be pointed at the same data the API is using (or a test fixture).
 */
const dataDir = process.env.BOOKSHELF_DATA_DIR
  ? path.resolve(process.env.BOOKSHELF_DATA_DIR)
  : path.join(repoRoot, 'data');

/**
 * A read-only sibling of `apps/api/src/data/jsonStore.ts` — deliberately simpler.
 * This server never writes, so none of the mutex/atomic-rename machinery that
 * exists to prevent lost updates applies here. A missing file is treated as `[]`,
 * matching `readCollection`'s behaviour in the API.
 */
async function readCollection<T>(collection: string): Promise<T[]> {
  const file = path.join(dataDir, `${collection}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.trim() === '' ? [] : (JSON.parse(raw) as T[]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export const readBooks = (): Promise<Book[]> => readCollection<Book>('books');
export const readShelves = (): Promise<Shelf[]> => readCollection<Shelf>('shelves');
