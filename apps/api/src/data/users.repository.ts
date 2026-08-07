import type { CreateUserInput, UpdateUserInput, User } from '@bookshelf/shared';

import { mutateCollection, readCollection } from './jsonStore';

const COLLECTION = 'users';

export function findAll(): Promise<User[]> {
  return readCollection<User>(COLLECTION);
}

export async function findById(id: string): Promise<User | undefined> {
  const users = await findAll();
  return users.find((user) => user.id === id);
}

/** Mirrors `nextBookId` in books.repository.ts — same scheme, `user_NNN`. */
function nextUserId(users: User[]): string {
  const highest = users.reduce((max, user) => {
    const match = /^user_(\d+)$/.exec(user.id);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);

  return `user_${String(highest + 1).padStart(3, '0')}`;
}

/** Inserts a profile and returns the persisted record. No uniqueness invariant to check. */
export function create(input: CreateUserInput): Promise<User> {
  return mutateCollection<User, User>(COLLECTION, (users) => {
    const user: User = {
      id: nextUserId(users),
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      favouriteGenres: input.favouriteGenres,
      createdAt: new Date().toISOString(),
    };

    return { items: [...users, user], result: user };
  });
}

/** Applies a partial update. Returns `undefined` if `id` matches nothing. */
export function update(id: string, patch: UpdateUserInput): Promise<User | undefined> {
  return mutateCollection<User, User | undefined>(COLLECTION, (users) => {
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) {
      return { items: users, result: undefined };
    }

    const updated: User = { ...users[index], ...patch };
    const items = [...users];
    items[index] = updated;
    return { items, result: updated };
  });
}

/** Returns `true` if a profile was removed, `false` if `id` matched nothing. */
export function remove(id: string): Promise<boolean> {
  return mutateCollection<User, boolean>(COLLECTION, (users) => {
    const filtered = users.filter((user) => user.id !== id);
    return { items: filtered, result: filtered.length !== users.length };
  });
}
