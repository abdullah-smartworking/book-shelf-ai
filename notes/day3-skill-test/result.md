# Exercise B — testing the scaffold-endpoint skill

**Skill:** [`.claude/skills/scaffold-endpoint/SKILL.md`](../../.claude/skills/scaffold-endpoint/SKILL.md)
**Test task:** scaffold `POST /api/books/:id/reviews` and `GET /api/books/:id/reviews`.

This is a real invocation, not a dry run — the skill's steps produced the actual
reviews feature now in the repo:

| Skill step | File produced |
|---|---|
| 1. Shared schema | *(skipped — already existed)* [`packages/shared/src/review.ts`](../../packages/shared/src/review.ts) |
| 2. Repository | [`apps/api/src/data/reviews.repository.ts`](../../apps/api/src/data/reviews.repository.ts) — added `create()` |
| 3. Service | [`apps/api/src/services/reviews.service.ts`](../../apps/api/src/services/reviews.service.ts) — new file |
| 4. Route | [`apps/api/src/routes/books.routes.ts`](../../apps/api/src/routes/books.routes.ts) — `GET`/`POST /:id/reviews` nested on `booksRouter` |
| 5. Wire it up | *(skipped — sub-resource, no top-level router change needed)* |
| 6. Test | [`apps/api/tests/reviews.test.ts`](../../apps/api/tests/reviews.test.ts) — new file |

## Did it follow the project's patterns?

- **Response shape:** `{ data: Review }` on create (201 + `Location`), `{ data: Review[] }`
  on list — matches the envelope convention, no `meta` added since there's nothing to
  paginate (a deliberate judgment call the skill's own constraints call out).
- **Data layer discipline:** `reviews.repository.create()` generates `review_NNN` ids
  *inside* `mutateCollection()`, exactly mirroring `nextBookId`/`books.repository.create` —
  the skill's reference example made this a copy of a known-good pattern rather than a
  fresh guess.
- **Field-by-field construction:** `reviews.service.createReview` never spreads the
  validated input into the repository call — same anti-mass-assignment discipline as
  `createBook`.
- **404 semantics:** `listReviewsForBook`/`createReview` both check the book exists first
  and throw `NotFoundError` — the skill's steps don't spell this out explicitly (it's a
  step the reference example didn't need, since `books.service` has no "does the parent
  exist" case), so this required reasoning from the "throw, don't set status" rule in
  `CLAUDE.md`/`api.mdc` rather than a literal instruction in the skill file.
- **Routing decision:** nested on `booksRouter` as `/:id/reviews` rather than a new
  top-level router — the skill's step 4 explicitly calls this out ("nest sub-resources on
  the parent router"), and `routes/index.ts`'s own (now-corrected) doc comment agreed.

## Where it needed a genuine decision, not just pattern-matching

The skill's "hard constraints" don't mention cross-collection consistency. Books and
reviews are two separately-locked collections (`jsonStore.ts`'s mutex is per-collection),
so a book deleted between the existence check and the review write would orphan a review.
Closing that gap needs a cross-collection lock the store doesn't have. This is documented
as a known limitation on `reviews.service.createReview` rather than silently ignored or
over-engineered with a lock that doesn't exist elsewhere in the codebase.

## Cursor equivalent

[`.cursor/rules/scaffold-endpoint.mdc`](../../.cursor/rules/scaffold-endpoint.mdc) —
same build-order and constraints, condensed, with a note pointing back at the full
`SKILL.md` for the reference code blocks (Cursor rules don't have Claude Code's on-demand
invocation; this is scoped to `apps/api/**/*.ts` and applies whenever that pattern
matches, rather than being explicitly invoked).

## How much editing was needed?

None, post-hoc — the code above is what shipped, not a draft that got rewritten
afterward. The one real "correction" was pre-emptive: the skill file itself documents
the field-by-field/mutateCollection/layering rules *because* those are exactly the
things a generic "add an endpoint" prompt tends to get wrong (per the skill's own
"anti-patterns seen on this exact codebase" section), so writing the skill carefully
up front is what avoided needing a correction pass afterward.

> The skill's highest-value section wasn't the numbered steps — it was the "reference
> example, copied verbatim" block. Steps say what to do; a real, working example from
> this exact codebase is what made the output indistinguishable from something a
> teammate who'd been here for months would write.
