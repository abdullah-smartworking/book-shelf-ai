# BookShelf

A personal book catalogue — a simplified Goodreads. Built across the 5-day
**AI-Enabled Developer** intensive as a monorepo.

**Day 1 status:** the API is scaffolded and the four core book endpoints work.
The frontend is deliberately not started (that is Day 2).

---

## Requirements

- **Node.js v20 or later** (uses `node:test`, global `fetch`, and Express 5)
- npm v10+ (ships with Node 20)

```bash
node --version   # must print v20.x or higher
npm --version
```

## Quick start

```bash
npm install
npm run dev
```

The API starts on <http://localhost:3000>. Override with `PORT=3001 npm run dev`.

```bash
npm test         # 20 integration tests, no test framework to install
npm run typecheck
```

---

## Endpoints

Implemented on Day 1:

| Method | Path                   | Purpose                                      |
| ------ | ---------------------- | -------------------------------------------- |
| `GET`  | `/health`              | Liveness probe                               |
| `GET`  | `/api/books`           | List books — filter, sort, paginate          |
| `GET`  | `/api/books/search?q=` | Search title / author / genre / description   |
| `GET`  | `/api/books/:id`       | One book, with its reviews embedded          |
| `POST` | `/api/books`           | Create a book                                |

`PUT`/`DELETE /api/books/:id`, the shelves endpoints and the reviews endpoints are
in the target spec but scheduled for later in the week.

### `GET /api/books`

| Query   | Type                                     | Default    |
| ------- | ---------------------------------------- | ---------- |
| `genre` | string — exact match, case-insensitive   | —          |
| `author`| string — substring match                 | —          |
| `year`  | integer — exact match                    | —          |
| `sort`  | `title` \| `author` \| `year` \| `addedAt` | `addedAt`  |
| `order` | `asc` \| `desc`                          | `desc`     |
| `page`  | integer ≥ 1                              | `1`        |
| `limit` | integer 1–100                            | `20`       |

```bash
curl 'http://localhost:3000/api/books?genre=Fantasy&sort=year&order=asc'
```

```json
{
  "data": [{ "id": "book_012", "title": "The Hobbit", "...": "..." }],
  "meta": { "total": 4, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### `GET /api/books/search?q=`

Case-insensitive substring search across title, author, genre and description.
Results are weighted — a title hit outranks an author hit outranks a genre hit
outranks a description hit — and each result reports which fields matched.

```bash
curl 'http://localhost:3000/api/books/search?q=ishiguro'
```

```json
{
  "data": [{ "id": "book_017", "title": "Never Let Me Go", "matchedOn": ["author"] }],
  "meta": { "query": "ishiguro", "total": 2, "limit": 20 }
}
```

### `POST /api/books`

`title`, `author`, `genre` and `year` are required. `isbn`, `description` and
`coverUrl` are optional. `id` and `addedAt` are set by the server and are ignored
if a client sends them.

```bash
curl -X POST http://localhost:3000/api/books \
  -H 'content-type: application/json' \
  -d '{
    "title": "The Three-Body Problem",
    "author": "Liu Cixin",
    "genre": "Science Fiction",
    "year": 2008,
    "isbn": "978-0765382030"
  }'
```

Returns `201 Created` with a `Location: /api/books/book_031` header.

---

## Response format

Every response uses one envelope, so a client never has to guess the shape.

Success:

```json
{ "data": ... , "meta": { ... } }
```

Failure:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "field": "year", "message": "year must be a number" }] } }
```

Branch on `code`, never on `message`:

| Status | `code`              | Meaning                              |
| ------ | ------------------- | ------------------------------------ |
| 400    | `VALIDATION_ERROR`  | A field failed validation            |
| 400    | `INVALID_JSON`      | Body was not parseable JSON          |
| 404    | `NOT_FOUND`         | The resource does not exist          |
| 404    | `ROUTE_NOT_FOUND`   | No such endpoint                     |
| 409    | `CONFLICT`          | Duplicate ISBN                       |
| 413    | `PAYLOAD_TOO_LARGE` | Body exceeded 100 kB                 |
| 500    | `INTERNAL_ERROR`    | A bug — check the server logs        |

---

## Structure

```
bookshelf/
├── apps/
│   ├── api/                        # Express 5 REST API (TypeScript, run via tsx)
│   │   ├── src/
│   │   │   ├── index.ts            # entry point: listen + graceful shutdown
│   │   │   ├── app.ts              # middleware pipeline assembly
│   │   │   ├── config.ts           # port, data dir, env
│   │   │   ├── errors.ts           # AppError + typed subclasses
│   │   │   ├── routes/             # HTTP layer only
│   │   │   ├── services/           # business logic, no HTTP
│   │   │   ├── data/               # JSON store + repositories
│   │   │   └── middleware/         # validation, logging, error handling
│   │   └── tests/                  # node:test integration tests
│   └── web/                        # Day 2
├── packages/
│   └── shared/                     # Zod schemas + inferred types (used by both apps)
├── data/
│   ├── books.json                  # 30 seed books across 10 genres
│   ├── shelves.json
│   └── reviews.json
├── notes/                          # Day 1 tool logs and comparison write-up
└── package.json                    # npm workspaces root
```

### Layering rule

```
routes/  →  services/  →  data/  →  data/*.json
(HTTP)      (logic)       (storage)
```

Each layer only talks to the one below it. `services/` contains no `req`/`res`;
`data/` is the only code that knows the store is a JSON file. Swapping in a real
database on Day 3 means rewriting `data/` and nothing else.

## Data store

No database — three JSON files in `data/`, each a top-level array, accessed through
`apps/api/src/data/jsonStore.ts`. That layer deliberately handles:

- **Atomic writes** — write to a temp file, then `rename()` over the target, so a
  crash mid-write cannot leave truncated JSON behind.
- **Serialised read-modify-write** — an in-process promise queue per collection, so
  two simultaneous `POST`s cannot both read 30 books and both write 31.

It deliberately does **not** handle multi-process access: two `node` processes
sharing the same file will still clobber each other. That needs OS file locking or
a real database, and is out of scope for a learning project.

Point the API at a different directory with `BOOKSHELF_DATA_DIR=/tmp/whatever`.
The test suite uses this to run against a throwaway copy.

## Notes on stack choices

- **TypeScript**, because types are context — they give AI tools far more to work
  with than bare JS, which is the point of the exercise.
- **`tsx`** runs TypeScript directly with no build step. `npm run typecheck` is the
  separate `tsc --noEmit` pass.
- **Express 5**, which forwards rejected promises from `async` handlers to the error
  middleware automatically. On Express 4 every handler needs a `try/catch` or an
  `asyncHandler` wrapper.
- **Zod** in `packages/shared`, so the runtime validator and the TypeScript type are
  the same declaration and cannot drift.
