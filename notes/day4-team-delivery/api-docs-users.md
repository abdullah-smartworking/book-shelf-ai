# User Profiles API

AI-generated from the actual route/service code (not from a template), then
checked claim-by-claim against `apps/api/src/routes/users.routes.ts` and
`apps/api/src/services/users.service.ts` — every behavior below was verified
against the code, not assumed from the endpoint name.

## `POST /api/users`

Creates a profile.

**Body:**
```json
{ "displayName": "Ada", "avatarUrl": "https://example.com/ada.png", "favouriteGenres": ["Science Fiction"] }
```
`avatarUrl` and `favouriteGenres` are optional — omitted, they default to `null`
and `[]`. `displayName` is required, 1–100 characters after trimming.

**Success — `201 Created`**, `Location: /api/users/:id`:
```json
{ "data": { "id": "user_001", "displayName": "Ada", "avatarUrl": null, "favouriteGenres": [], "createdAt": "2026-01-01T00:00:00.000Z" } }
```
Note: this response has **no `stats` field** — a brand-new profile has zero
reviews by definition, so the frontend doesn't need a second request to know
that, but the wire response itself doesn't include it.

**Failure — `400 VALIDATION_ERROR`** — missing/empty `displayName`, or an
`avatarUrl` that isn't a valid URL.

## `GET /api/users`

Lists all profiles. `200 { "data": User[] }` — no pagination, same convention
as `GET /api/lists` (this resource is expected to stay small).

## `GET /api/users/:id`

One profile, **with computed stats embedded** — unlike the `POST`/`PUT`
responses.

**Success — `200`:**
```json
{
  "data": {
    "id": "user_001", "displayName": "Ada", "avatarUrl": null, "favouriteGenres": [],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "stats": { "reviewCount": 3, "averageRatingGiven": 4.3 }
  }
}
```
`stats` is computed from `reviews.json` on every read, never stored —
`averageRatingGiven` is `null` (not `0`) when `reviewCount` is `0`, rounded to
one decimal place otherwise.

**Failure — `404 NOT_FOUND`** for an unknown id.

## `PUT /api/users/:id`

Partial update — only the fields present in the body change.

**Body (any subset, at least one required):**
```json
{ "displayName": "Ada Lovelace" }
```

**Success — `200`:** a bare `User` object, same shape as the `POST` response
— **no `stats` field here either.** If your frontend is showing stats
alongside a profile, keep whatever `stats` you already have; don't expect
this response to refresh them (they didn't change — this endpoint can't touch
reviews).

**Failure —** `400 VALIDATION_ERROR` for an empty body or an invalid field
value; `404 NOT_FOUND` for an unknown id.

## `DELETE /api/users/:id`

`204 No Content` on success. `404 NOT_FOUND` if the id never existed, or on a
second delete of the same id.

## `GET /api/users/:id/activity`

Recent reviews by this user, newest first.

**Success — `200`:**
```json
{ "data": [ { "id": "review_005", "bookId": "book_012", "userId": "user_001", "rating": 5, "text": "…", "createdAt": "2026-01-05T00:00:00.000Z" } ] }
```
An empty array (not a 404) if the user exists but has never reviewed
anything.

**Failure — `404 NOT_FOUND`** if the user doesn't exist.

**Known limitation, not a bug:** despite the exercise brief describing this
as "recent reviews, reading list updates," this endpoint returns **reviews
only**. The Reading Lists feature (`List` type) has no `userId` field at all —
lists aren't owned by anyone in this codebase — so there's nothing to
attribute a "list update" to. Adding user-ownership to Lists would be a real
change to an already-shipped feature, out of scope for this endpoint.
