import type { CreateListInput, List } from '@bookshelf/shared';

import { mutateCollection, readCollection } from './jsonStore';

const COLLECTION = 'lists';

/**
 * Repository = the only place in the codebase that knows reading lists live in a
 * JSON array. Mirrors `books.repository.ts`'s shape exactly — same atomicity
 * discipline, same id scheme, just for `list_NNN` instead of `book_NNN`.
 */

export function findAll(): Promise<List[]> {
  return readCollection<List>(COLLECTION);
}

export async function findById(id: string): Promise<List | undefined> {
  const lists = await findAll();
  return lists.find((list) => list.id === id);
}

/** Mirrors `nextBookId` in books.repository.ts — same scheme, `list_NNN`. */
function nextListId(lists: List[]): string {
  const highest = lists.reduce((max, list) => {
    const match = /^list_(\d+)$/.exec(list.id);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);

  return `list_${String(highest + 1).padStart(3, '0')}`;
}

/**
 * Inserts a list and returns the persisted record. Unlike `books.repository.create`,
 * there is no uniqueness invariant to guard here — nothing stops two lists sharing a
 * name — so id generation is the only reason this needs to run inside the mutator
 * rather than a plain read-then-write.
 */
export function create(input: CreateListInput): Promise<List> {
  return mutateCollection<List, List>(COLLECTION, (lists) => {
    const list: List = {
      id: nextListId(lists),
      name: input.name,
      description: input.description,
      bookIds: [],
      createdAt: new Date().toISOString(),
    };

    return { items: [...lists, list], result: list };
  });
}

/**
 * Applies `add`/`remove` to a list's `bookIds` and returns the persisted record, or
 * `undefined` if `id` matches nothing (the service turns that into a 404).
 *
 * Whether a book id in `add` actually exists in `data/books.json` is NOT this
 * function's concern — that check reads a different collection entirely, and
 * `mutateCollection` only holds a lock on *this* collection, so validating a
 * cross-collection invariant inside this mutator wouldn't make it any more atomic.
 * The service checks it beforehand instead (same precedent as
 * `reviews.service.createReview` checking book existence before writing a review).
 *
 * `remove` is applied before `add`: if the same id appears in both arrays, the net
 * effect is that it ends up present. Not specified by the contract either way; this
 * reads as the more intuitive "reconcile then add" interpretation of simultaneous
 * add+remove instructions.
 */
export function update(
  id: string,
  changes: { add: string[]; remove: string[] },
): Promise<List | undefined> {
  return mutateCollection<List, List | undefined>(COLLECTION, (lists) => {
    const index = lists.findIndex((list) => list.id === id);
    if (index === -1) {
      return { items: lists, result: undefined };
    }

    const current = lists[index];
    const afterRemoval = current.bookIds.filter((bookId) => !changes.remove.includes(bookId));
    const additions = changes.add.filter((bookId) => !afterRemoval.includes(bookId));
    const updated: List = { ...current, bookIds: [...afterRemoval, ...additions] };

    const items = [...lists];
    items[index] = updated;
    return { items, result: updated };
  });
}

/**
 * Deletes a list. Returns `true` if something was removed, `false` if `id`
 * matched nothing — the service turns that into a 404.
 */
export function remove(id: string): Promise<boolean> {
  return mutateCollection<List, boolean>(COLLECTION, (lists) => {
    const filtered = lists.filter((list) => list.id !== id);
    return { items: filtered, result: filtered.length !== lists.length };
  });
}
