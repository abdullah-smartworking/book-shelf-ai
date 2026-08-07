# Exercise B — Agent Teams: integration notes

Three agents (Backend, Test, Frontend), each in an isolated git worktree, each
given only [`api-contract.md`](api-contract.md) and told explicitly not to
look at the others' work. What follows is what actually happened integrating
their output — not a cleaned-up version.

## Friction #1 — the contract itself didn't reach every agent as expected

All three worktrees turned out to be branched from `main` at the commit
*before* the contract file was committed to `feature/reading-lists` — not from
the branch I was actually on when I spawned them. Every agent had to notice
this and recover (retrieving the contract text via `git show
feature/reading-lists:notes/day4-agent-teams/api-contract.md` rather than
reading a checked-out copy). All three did recover correctly, but this is a
real, non-obvious operational lesson: **worktree isolation snapshots from
whatever base existed when the tooling initialized the worktree, which is not
guaranteed to include commits you just made on your currently-checked-out
branch.** Writing the contract first didn't fully prevent this — writing it
*and confirming it's reachable from the base each agent will actually start
from* would.

## Friction #2 — a real type mismatch, not a naming mismatch

`packages/shared/src/list.ts`'s `updateListBooksSchema` uses
`.optional().default([])` on both `add` and `remove`. Backend agent exported
`UpdateListBooksInput = z.infer<typeof updateListBooksSchema>` — following the
exact same pattern as every other `*Input` type in this codebase
(`CreateBookInput`, `CreateReviewInput`, etc.). Frontend agent, working blind
in a separate worktree with no access to that file, wrote its own local
interface — `{ add?: string[]; remove?: string[] }` — a direct, reasonable
reading of the contract's plain English ("at least one of add or remove"
implies either can be omitted).

**Both are defensible individually. Only one compiles against the other.**
`z.infer` (= `z.output`) reflects the schema's *parsed* shape, where
`.default([])` guarantees the field is always present — so the real type is
`{ add: string[]; remove: string[] }`, not what Frontend assumed. This didn't
show up as a test failure or a runtime bug; it showed up as a `tsc` error the
moment both pieces were compiled together, in exactly the two places where a
caller constructs a partial update (`AddToListControl.tsx`,
`useListDetail.ts`'s `removeBook`).

**The fix wasn't "pick a winner"** — both were right for their own use case.
`packages/shared/src/list.ts` now exports two types: `UpdateListBooksInput`
(`z.infer` — what the service receives after parsing, both fields present)
and `UpdateListBooksRequest` (`z.input` — what a caller sends, genuinely
partial). This is the first shared type in this codebase used on both sides of
that boundary, which is exactly why the distinction never mattered until now.

> This is a better example of "integration friction" than a naming mismatch
> would have been. Naming mismatches are caught by `tsc` immediately and fixed
> by renaming. This one required understanding *why* two individually-correct
> pieces of code disagreed — a real design question (what does "optional"
> mean, before vs. after validation?) that neither agent was wrong to answer
> the way it did.

## Counter-finding — the part that matched perfectly

`packages/shared/src/list.ts` (Backend, real) and Frontend's local shim
matched **field-for-field**, everywhere except the one case above. And the
Test agent's 22-test suite — written blind, against the contract, with zero
visibility into Backend's actual implementation — **passed all 22 on the
first run against Backend's actual code, with zero changes to the test
file.** That's not the outcome the Day 4 mentor notes predict ("expect...
naming mismatches, slightly different data shapes" between tests and
implementation) — and I'm reporting it because it happened, not because it's
the tidier story. The contract being genuinely complete and precise (an exact
endpoint table, exact status codes, exact idempotency semantics spelled out in
prose) is almost certainly why: the one real ambiguity that caused a problem
(optional vs. required in a *derived* TypeScript type) was a Zod-specific
subtlety the contract's plain-English table couldn't have caught even if
everyone had read it perfectly — it only exists at the type-system level, not
the API-behavior level the contract was written at.

## What agents flagged themselves, unprompted

All three, independently, without being asked to look for this, called out
that "Reading Lists" and the still-unbuilt "shelves" feature (flagged in
`CLAUDE.md`'s Known Limitations since Day 1) are conceptually the same idea —
named-list-of-books, user-owned. None treated this as license to merge them or
reuse `shelves.json`; all three built the separate resource the exercise
explicitly asked for, and just noted the overlap. Consistent with how this
project's rules ("don't widen scope, flag what you're not doing") have shaped
every agent's behavior so far, not just this one.

## How much manual fixing was actually needed

- Copy files from three worktrees into one branch (they never commit unless
  told to — a good default, but means "merge the branches" doesn't work;
  integration is a file-copy + reconcile step, not a `git merge`).
- Delete Frontend's local type shim, repoint 4 files' imports to
  `@bookshelf/shared`.
- Upgrade `CreateListForm` from hand-rolled validation to `.safeParse` against
  the now-real `createListSchema` (Frontend's own code comment flagged this as
  a TODO once the real schema existed — followed through on it).
- Split one type into two, fix two call sites.
- Everything else — the actual `POST`/`GET`/`PUT`/`DELETE` logic, the
  `node:test` suite, the five React components/hooks/pages — needed **zero**
  changes.

That's roughly 20 minutes of integration work for three agents' worth of a
complete CRUD feature (backend + tests + frontend) built in parallel. The
API contract is what made that ratio possible.
