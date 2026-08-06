# Exercise C — sub-agent delegation: result and assessment

**Output:** [`apps/api/tests/search.test.ts`](../../apps/api/tests/search.test.ts) — 5 new
test cases, verified by reading the file (not just trusting the sub-agent's own summary):
a genuine no-match returning `200`/empty rather than a 404, ALL-CAPS and MiXeD-case
matches, a loop over 8 special/non-ASCII query strings asserting no crash, and an empty
`q=` correctly rejected with the same `VALIDATION_ERROR` as a missing `q`.

**Deviation from the brief, made deliberately before delegating:** the course's suggested
prompt says "write comprehensive Jest tests... mock the data access layer." Both of those
are wrong for this codebase — there is no Jest here (`node:test` via `tsx --test`, see
`CLAUDE.md`), and the existing test suite's entire philosophy is real HTTP against a real
temp-dir-backed server, never a mock. Handing the sub-agent the brief's literal wording
would have produced a file that doesn't run. This is the same "adapt the generic
instruction to the actual project" judgment call the whole course has been building
toward — it just happened before delegation instead of during review.

**Second deviation:** the search endpoint already has 4 tests in `books.test.ts`. Asking
for "comprehensive" coverage from scratch would have duplicated most of it. The task was
narrowed to the specific gaps (no-match, case sensitivity, special characters, empty
query) so the sub-agent's output is additive, not redundant.

## Did it follow CLAUDE.md's rules?

Yes — verified directly against the file, not assumed:
- `node:test`/`node:assert/strict` imports, no mocking framework.
- Isolated temp dir via `fs.mkdtemp`, `BOOKSHELF_DATA_DIR` set *before* the dynamic
  `await import('../src/app')` — got the ordering right without being told the specific
  reason (`config.ts` reads the env var at module-load time), reasoning it out from
  reading `books.test.ts`'s existing comment.
- Cleanup in `after()`.
- Correctly predicted from reading `book.ts` that `q=''` fails `min(1)` the same as a
  missing `q`, rather than guessing.

## Context: what it had vs. what it needed

Everything it needed was in the repository already — the query schema, the response
envelope types (`ApiSearchResponse`), and the search algorithm's exact matching logic
(a plain substring scan, confirmed by reading `books.service.ts` rather than assumed,
which is what let it assert confidently that special characters can't crash a regex
that's never constructed). Nothing required a check-in with the main session; the two
tasks (PUT endpoint, search tests) touch completely disjoint code paths.

## Was the parallelism worth it?

Yes, cleanly — this is close to the ideal case the course predicts. The two tasks:
- Touch different files (no merge conflict risk).
- Have no data dependency on each other (PUT doesn't affect search; the sub-agent's new
  test file is fully self-contained with its own seed data).
- Had unambiguous, well-specified briefs, so the sub-agent didn't have to guess at
  behavior — it verified assumptions by reading source rather than inventing them.

The only review overhead was reading the finished file to confirm it was correct (a few
minutes) — comparable to reviewing a teammate's small PR, not to redoing the work.

> The task that made this a *good* delegation wasn't independence alone — plenty of
> tasks are independent but underspecified. It was independence **plus** every fact the
> sub-agent needed being discoverable by reading the codebase, so "well-specified" didn't
> require me to write out every schema and file path by hand. A vaguer brief on the same
> task would have produced generic Jest-with-mocks output that needed a full rewrite.
