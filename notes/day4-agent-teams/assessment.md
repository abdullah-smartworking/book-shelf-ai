# Exercise B — Agent Teams: assessment

## Agent briefs used

Full prompts are long (each referenced the contract and specific existing
files to mirror) — the essential brief for each, condensed:

- **Backend:** implement the full CRUD feature per the contract, mirroring
  `books.repository.ts`/`books.service.ts`/`books.routes.ts`'s exact layering.
  No tests, no frontend.
- **Test:** write `node:test` integration tests against the contract (not the
  implementation, which may not exist in this worktree), mirroring
  `reviews.test.ts`'s isolation pattern. No implementation.
- **Frontend:** build the Reading Lists UI against the contract, following
  existing page/hook/component conventions exactly. No tests, no backend.

## Did this save time vs. building it sequentially myself?

**Yes, clearly** — three agents produced a complete, working, tested,
end-to-end CRUD feature (4 backend files, 1 test file with 22 cases, 7
frontend files) in parallel, and the total integration cost was one type
split, four import fixes, and one component upgraded to use a real schema
once it existed. Building this sequentially — backend, then tests, then
frontend, each waiting on the last — would have taken noticeably longer than
three agents working simultaneously plus ~20 minutes of reconciliation.

## Where it created overhead instead of saving time

Nowhere significant here, but the one place it *could* have: the worktree
base-commit mismatch (see [integration-notes.md](integration-notes.md)) added
work for every agent, not just one — three separate instances of "reconstruct
the contract from git" instead of one. Small in this case because it was a
single file; would compound badly on a larger contract or if an agent hadn't
noticed the mismatch and had guessed instead of checking.

## Did the API contract prevent conflicts?

**Mostly, and the one place it didn't is instructive.** It fully prevented
naming/shape conflicts at the *data* level — every field name, type, status
code, and idempotency rule matched across all three agents' independent
work. It did not, and couldn't have, prevented the one *type-system*-level
conflict (`z.infer` vs `z.input` on a schema with `.optional().default()`),
because that's not a question the contract's prose was written to answer — a
contract that specifies "the endpoint accepts an object with either or both
of `add`/`remove`" is a complete and correct API spec; it just doesn't
disambiguate which of two different TypeScript views of that same behavior a
shared type should export. Closing that gap would need the contract to go one
level lower — specifying the actual shared-package type declarations, not
just the wire format — which is more ceremony than a 10-minute planning step
should carry for a feature this size.

## What I'd decompose differently next time

Two things:
1. **Verify the contract is reachable from each agent's actual base before
   spawning**, not just committed on my own branch — a `git log` check on one
   throwaway worktree first would have caught the mismatch before running it
   three times.
2. **For any shared type built on a schema using `.optional()` with a
   `.default()`, decide `z.input` vs `z.infer` explicitly in the contract**,
   the same way the contract already pins down status codes and idempotency —
   this is now a known, specific failure mode, not a hypothetical one.

## One sentence

The contract eliminated every conflict it was written to address (naming,
shapes, status codes, semantics) and surfaced exactly one conflict it wasn't
— a genuine, narrow gap in what "written contract" covers, not a failure of
writing one.
