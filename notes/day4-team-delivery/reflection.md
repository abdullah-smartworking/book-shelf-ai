# Exercise D — Team Delivery Simulation: reflection

**Task:** User Profiles — CRUD, activity feed, profile editing, tests, docs, PR.

- **Plan → Build → Review** all landed in one pass: skill-scaffolded the
  backend directly (no sub-agent needed for that part — a single-session
  invocation was faster than spawning one), one sub-agent wrote the test
  suite in parallel while the frontend was built by hand, MCP supplied the
  real genre list for the profile form instead of guessing one.
- **Where AI accelerated most:** the skill's build order (schema → repo →
  service → route) meant zero back-and-forth on layering — every file landed
  in the right shape on the first pass, same as Exercise A/B's endpoints.
- **Where I overrode AI output:** none this time from a sub-agent — but I
  caught and fixed two of my own mistakes before they shipped: (1) copying
  the Exercise B `.default()` mistake almost happened again in
  `updateUserSchema`, avoided by mirroring `updateBookSchema`'s no-`.default()`
  pattern explicitly; (2) `createUser`/`updateUser` were briefly mistyped as
  returning `UserWithStats` with fabricated zero stats — for `updateUser` that
  would have silently erased a real user's stats on every profile edit. Caught
  by typechecking against the real route code, not by assuming the shape.
- **Scope calls, flagged not hidden:** activity feed is reviews-only (Lists
  has no `userId` field to attribute list activity to); component tests
  skipped entirely (no frontend test framework exists in this repo, and
  adding one is a dependency decision on the same footing as the MCP SDK's).
- **What I'd do differently:** less manual browser click-through per feature
  — the typecheck + `node:test` suite is the actual bar this exercise cares
  about, and time is better spent there than re-verifying visually what the
  tests already prove.

**One sentence — Day 1 vs Day 4:** Day 1 was one prompt producing one
uncertain result; Day 4 is a repeatable pipeline — contract, skill, parallel
agent, MCP, review — where most of the judgment calls are now "which existing
convention does this new piece mirror," not "what should this look like from
scratch."
