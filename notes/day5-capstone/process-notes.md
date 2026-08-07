# Capstone process notes — Book Recommendations

**Tools used and why:** Sonnet (this whole session) for the build — no need for
a stronger/slower model, the logic is a small, well-scoped scoring function,
not an ambiguous design problem. The `bookshelf` MCP server to check real
genre distribution before finalizing the scoring/cap. One background sub-agent
attempted for tests in parallel (see below — didn't pan out this time).

**Where AI helped most:** the whole build, start to finish — this is the
normal mode for this project by Day 5, not a special case.

**Where I had to correct/override:**
1. **The sub-agent, not me this time.** I spawned a test-writing sub-agent in
   an isolated worktree (same pattern that worked cleanly in Exercise D). It
   correctly *refused* to write tests — its worktree had branched from `main`,
   which doesn't even have the User Profiles feature merged yet, so the code
   under test didn't exist there. It reported this honestly instead of
   guessing or copying forbidden files. Good behavior, but it meant the
   parallelization didn't actually save time this round — I wrote the test
   file myself afterward.
2. **My own test, not the service.** The first test run failed one case. The
   bug was in the *test's* seed data, not the service: I asserted that an
   already-reviewed book should reappear in "inferred genre" recommendations,
   which is backwards — the service correctly excludes any reviewed book,
   full stop. Fixed by adding a second, unreviewed book in that genre to
   actually test the claim.

**What I'd do differently next time:** stop re-spawning worktree-isolated
sub-agents for small features. Across five uses this week, the worktree base
mismatch has hit *every single time* it's been tried on a branch other than
`main` itself. For a change this size, writing the test directly was faster
than diagnosing why the agent couldn't see the code — I should default to
"write it myself" for anything not branched directly off `main`, and only
delegate to a sub-agent when the base branch problem is worth solving for
(e.g. a genuinely large multi-file feature like Exercise B's Reading Lists).

**Verification, not just "it runs":**
- 91/91 backend tests pass (5 new + 86 existing), clean typecheck.
- Checked against real seed data, not just the isolated test's synthetic
  seed — created a real profile for `user_001` and confirmed the response
  matched the exact expected count (7 = 10 books across 2 matched genres
  minus 3 already-reviewed).

**Estimated time without AI vs. actual:** the algorithm design + backend +
frontend + tests + docs took roughly 20-25 minutes of actual work this
session. Hand-writing the equivalent (including working out the scoring
tie-break logic, the three-file layering, a matching test suite, and the
frontend wiring) would reasonably take 2-3 hours for someone unfamiliar with
this exact codebase's conventions, less for someone who wrote them — the
honest comparison isn't "AI vs. no AI in general," it's "AI once the
conventions already exist vs. establishing them from scratch," which is
the same lesson Day 2's context-showdown exercise already found.
