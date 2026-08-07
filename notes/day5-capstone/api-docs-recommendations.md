# Book Recommendations API

## `GET /api/users/:id/recommendations`

Up to 10 books this user hasn't reviewed yet, ranked by genre match strength.

**Scoring:**
- **2** — the book's genre is in the user's `favouriteGenres`
- **1** — not a stated favourite, but the user gave a book in that genre a
  rating of 4 or 5 in a review (an inferred preference)
- Excluded entirely — no signal connecting the genre to this user, or the
  user has already reviewed this exact book (never recommend something
  already read, even if it's their favourite genre)

Ties within the same score are broken by most recently added.

**Success — `200`:**
```json
{ "data": [ { "id": "book_009", "title": "The Left Hand of Darkness", "genre": "Science Fiction", "...": "..." } ] }
```
An empty array (not an error) if the user has no favourite genres and no
reviews — there's nothing to base a recommendation on.

**Failure — `404 NOT_FOUND`** if the user doesn't exist.

**Verified against real seed data**, not just the isolated test suite: created
a real profile for `user_001` (favourite genre: Philosophy) and confirmed the
actual response — their one Philosophy book was correctly excluded (already
reviewed), and Science Fiction/Technology recommendations correctly appeared
from their real 4-5 star review history, with the count matching the exact
math (10 books across those two genres, minus the 3 they'd already reviewed
= 7 results, which is exactly what came back).
