# Search endpoint

Here's the short version of what I'm building: right now your API can hand back *a* book if you already know its id, and *all* the books if you ask for the list. A search endpoint is the middle ground — the reader walks up and says "something with 'hobbit' in the title," and the endpoint scans the shelf and hands back the matching subset, a few at a time.

Mechanically it's one `GET` route that reads a query string off the URL, turns it into a `WHERE ... LIKE ...` filter, and returns matches plus a count so the caller can page through them.

## What I assumed

You didn't say which stack, so I went with **FastAPI + SQLAlchemy (2.0 style) + Pydantic v2**, since that's the most common shape for a BookShelf-style project and it's what a `/books` CRUD backend usually looks like. I also assumed:

- A `Book` SQLAlchemy model with `id`, `title`, `author`, `description`, `published_year`.
- A `get_db` dependency and a `BookRead` (or similar) response schema already exist.
- A synchronous `Session`, not `AsyncSession`.
- Routers live under `app/routers/` and are included in `app/main.py`.

**All of those are guesses.** The two most likely mismatches are the model field names and sync-vs-async, and I've isolated both so they're a small edit rather than a rewrite — see "If my guesses were wrong" at the bottom. If you're actually on Express, Django REST, or Flask, say so and I'll port it; the design translates directly.

## The endpoint

```
GET /books/search?q=hobbit&author=tolkien&year_from=1930&limit=20&offset=0&sort=title
```

| Param | Default | Notes |
|---|---|---|
| `q` | required | Case-insensitive substring match across title, author, description |
| `author` | – | Optional narrowing filter, substring match |
| `year_from` / `year_to` | – | Optional inclusive range on `published_year` |
| `limit` | 20 | 1–100 |
| `offset` | 0 | For paging |
| `sort` | `relevance` | `relevance`, `title`, `-title`, `year`, `-year` |

Response:

```json
{
  "query": "hobbit",
  "total": 2,
  "limit": 20,
  "offset": 0,
  "items": [
    { "id": 7, "title": "The Hobbit", "author": "J.R.R. Tolkien", "published_year": 1937 }
  ]
}
```

I wrapped the list in an envelope rather than returning a bare JSON array, because a search result is useless without `total` — otherwise the client can't tell "no more results" from "there are more, keep asking." `total` is the count *before* `limit`/`offset` are applied.

## `app/schemas/search.py`

```python
from typing import Generic, Sequence, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class SearchResults(BaseModel, Generic[T]):
    """Envelope for paginated search results."""

    query: str = Field(description="The search term that produced these results.")
    total: int = Field(description="Total matches, ignoring limit/offset.")
    limit: int
    offset: int
    items: Sequence[T]
```

## `app/routers/search.py`

```python
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db          # adjust if your dependency lives elsewhere
from app.models import Book              # adjust to your model's import path
from app.schemas import BookRead         # adjust to your existing read schema
from app.schemas.search import SearchResults

router = APIRouter(prefix="/books", tags=["books"])

# The only place field names appear. Rename/trim these to match your model.
SEARCH_FIELDS = (Book.title, Book.author, Book.description)

SORT_OPTIONS = {
    "title": asc(Book.title),
    "-title": desc(Book.title),
    "year": asc(Book.published_year),
    "-year": desc(Book.published_year),
}

MAX_QUERY_LENGTH = 100


def _escape_like(term: str) -> str:
    """Escape LIKE wildcards the user typed literally.

    Without this, a search for "50%" or "_" matches everything.
    """
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_pattern(term: str) -> str:
    """A "contains" pattern for LIKE."""
    return f"%{_escape_like(term)}%"


@router.get("/search", response_model=SearchResults[BookRead])
def search_books(
    q: str = Query(
        ...,
        min_length=1,
        max_length=MAX_QUERY_LENGTH,
        description="Search term matched against title, author and description.",
    ),
    author: str | None = Query(None, max_length=MAX_QUERY_LENGTH),
    year_from: int | None = Query(None, ge=0),
    year_to: int | None = Query(None, ge=0),
    sort: Literal["relevance", "title", "-title", "year", "-year"] = "relevance",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> SearchResults[BookRead]:
    """Search the shelf by keyword, with optional filters and paging."""
    term = q.strip()
    pattern = _like_pattern(term)

    # ilike() renders as a case-insensitive LIKE on Postgres and as
    # lower(col) LIKE lower(?) on SQLite, so this works on both.
    conditions = [
        or_(*[field.ilike(pattern, escape="\\") for field in SEARCH_FIELDS])
    ]

    if author:
        conditions.append(Book.author.ilike(_like_pattern(author.strip()), escape="\\"))
    if year_from is not None:
        conditions.append(Book.published_year >= year_from)
    if year_to is not None:
        conditions.append(Book.published_year <= year_to)

    # Count first, on the same filters but without ordering or paging.
    total = db.scalar(
        select(func.count()).select_from(Book).where(*conditions)
    ) or 0

    stmt = select(Book).where(*conditions)

    if sort == "relevance":
        # Cheap, dependency-free relevance: exact title beats title-prefix,
        # which beats a hit anywhere else. Ties broken alphabetically.
        stmt = stmt.order_by(
            asc(
                case(
                    (func.lower(Book.title) == term.lower(), 0),
                    (Book.title.ilike(f"{_escape_like(term)}%", escape="\\"), 1),
                    else_=2,
                )
            ),
            asc(Book.title),
        )
    else:
        stmt = stmt.order_by(SORT_OPTIONS[sort], asc(Book.id))

    books = db.scalars(stmt.limit(limit).offset(offset)).all()

    return SearchResults[BookRead](
        query=term,
        total=total,
        limit=limit,
        offset=offset,
        items=books,
    )
```

Two things worth flagging in there:

**Wildcard escaping.** A raw `f"%{q}%"` means a user searching for `%` gets every book back, and `_` matches any single character. `_like_pattern` escapes those so they're treated as literal text. Small bug, easy to miss, annoying to debug later.

**`/search` must be registered before `/{book_id}`.** If your existing books router declares `GET /books/{book_id}` first and you paste this route after it, FastAPI matches `/books/search` against `/{book_id}` and tries to parse `"search"` as an int — you get a 422 instead of results. Including this router *before* the books router (below) avoids that. If you'd rather put the handler directly in your existing `books.py`, move it above the `/{book_id}` route.

## `app/main.py` — wiring

```python
from app.routers import books, search

app.include_router(search.router)   # before books, so /search wins over /{book_id}
app.include_router(books.router)
```

## `tests/test_search.py`

```python
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def shelf(client: TestClient):
    """Three books with deliberately overlapping text."""
    payloads = [
        {"title": "The Hobbit", "author": "J.R.R. Tolkien", "published_year": 1937,
         "description": "A hobbit leaves home."},
        {"title": "The Silmarillion", "author": "J.R.R. Tolkien", "published_year": 1977,
         "description": "Myths of Middle-earth."},
        {"title": "Dune", "author": "Frank Herbert", "published_year": 1965,
         "description": "Desert planet, giant worms."},
    ]
    return [client.post("/books", json=p).json() for p in payloads]


def test_matches_title_case_insensitively(client, shelf):
    body = client.get("/books/search", params={"q": "hOBBiT"}).json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "The Hobbit"


def test_matches_author_and_description_too(client, shelf):
    assert client.get("/books/search", params={"q": "tolkien"}).json()["total"] == 2
    assert client.get("/books/search", params={"q": "worms"}).json()["total"] == 1


def test_no_matches_returns_empty_not_404(client, shelf):
    r = client.get("/books/search", params={"q": "zzzzz"})
    assert r.status_code == 200
    assert r.json() == {"query": "zzzzz", "total": 0, "limit": 20, "offset": 0, "items": []}


def test_year_range_filter(client, shelf):
    body = client.get(
        "/books/search", params={"q": "the", "year_from": 1950, "year_to": 1980}
    ).json()
    assert [b["title"] for b in body["items"]] == ["The Silmarillion"]


def test_total_ignores_paging(client, shelf):
    body = client.get("/books/search", params={"q": "tolkien", "limit": 1}).json()
    assert body["total"] == 2
    assert len(body["items"]) == 1


def test_wildcards_are_literal_not_match_all(client, shelf):
    """A search for "%" should find nothing, not everything."""
    assert client.get("/books/search", params={"q": "%"}).json()["total"] == 0


def test_missing_query_is_rejected(client):
    assert client.get("/books/search").status_code == 422
    assert client.get("/books/search", params={"q": ""}).status_code == 422


def test_limit_is_capped(client):
    assert client.get("/books/search", params={"q": "a", "limit": 5000}).status_code == 422
```

These assume you already have a `client` fixture (a `TestClient` over a fresh test DB) in `tests/conftest.py`, and that `POST /books` is your create route. If your fixture is named differently, that's the only change needed.

## If my guesses were wrong

- **Different field names** — edit `SEARCH_FIELDS` and the `year_from`/`year_to` conditions. Nothing else touches column names.
- **Async SQLAlchemy** — make the handler `async def`, take `AsyncSession`, and `await db.scalar(...)` / `(await db.scalars(...)).all()`. The query building is unchanged.
- **No `description` column** — drop it from `SEARCH_FIELDS`; the `or_` handles any number of fields.

## Worth knowing for later

`ILIKE '%term%'` can't use a normal B-tree index, so every search is a full table scan. That's completely fine for a shelf of hundreds or thousands of books — and I'd leave it here rather than adding machinery you don't need yet. When it does get slow, the upgrades in order of effort are: a `pg_trgm` GIN index on Postgres (keeps this exact code, just makes it fast), then Postgres full-text search with `tsvector` if you want stemming and ranking, then SQLite's FTS5 if you're staying on SQLite.

I'd also skip `q`-less "browse everything" behaviour here on purpose — that's what your existing `GET /books` list route is for, and keeping the two separate means neither one grows a pile of conditionals.
