# Exercise C Part 1 — the prompt, verbatim (NO design direction)

Functional requirements and the API contract only. Deliberately contains **no**
mention of colour, layout, spacing, typography, grid, cards, hover states, CSS
framework, or responsiveness. The word "design" never appears.

---

Build a React frontend for my book catalogue API in `apps/web`.

The API is already running at `http://localhost:3001`. Endpoints you need:

```
GET /api/books
  → { data: Book[], meta: { total, page, limit, totalPages } }

GET /api/books/search?q=<term>
  → { data: BookSearchHit[], meta: { query, total, limit } }
```

A `Book` looks like this:

```json
{
  "id": "book_001",
  "title": "The Pragmatic Programmer",
  "author": "David Thomas, Andrew Hunt",
  "genre": "Technology",
  "year": 1999,
  "isbn": "978-0135957059",
  "description": "A guide to software craftsmanship...",
  "coverUrl": null,
  "addedAt": "2025-01-15T10:30:00Z"
}
```

A `BookSearchHit` is a `Book` plus `matchedOn: Array<'title'|'author'|'genre'|'description'>`.

Errors come back as `{ error: { code, message } }`.

Requirements:

1. Use Vite and React with TypeScript.
2. A catalogue page that shows all the books from `GET /api/books`.
3. Each book should show its title, author, genre and year.
4. A search box. When the user types a term, call `GET /api/books/search?q=` and show
   the matching books. Clearing the box goes back to the full list.
5. Handle the loading state and the error state.
6. It must build and run.
