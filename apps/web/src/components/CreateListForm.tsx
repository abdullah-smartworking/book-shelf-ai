import { useState } from 'react';

import type { CreateListInput } from '@bookshelf/shared';
import { createListSchema } from '@bookshelf/shared';

export function CreateListForm({
  onSubmit,
  isSubmitting,
  submitError,
}: {
  onSubmit: (input: CreateListInput) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    // Same schema the server validates with, so a rejection here is guaranteed
    // to also be rejected there, and vice versa — see ReviewForm for the same pattern.
    const result = createListSchema.safeParse({ name, description });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setFieldError(null);

    try {
      await onSubmit(result.data);
    } catch {
      // submitError (from the hook) already carries the message; fields are left
      // as-is so the user doesn't have to retype anything, same as ReviewForm.
      return;
    }

    setName('');
    setDescription('');
  }

  const errorToShow = fieldError ?? submitError;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-serif text-base font-semibold text-ink">New list</h2>

      <div className="mt-3">
        <label htmlFor="list-name" className="text-xs font-medium text-muted">
          Name
        </label>
        <input
          id="list-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="list-description" className="text-xs font-medium text-muted">
          Description (optional)
        </label>
        <input
          id="list-description"
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      {errorToShow !== null && <p className="mt-2 text-xs text-accent">{errorToShow}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white
                   transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Creating…' : 'Create list'}
      </button>
    </form>
  );
}
