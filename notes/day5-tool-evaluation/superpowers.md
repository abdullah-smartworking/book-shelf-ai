# Exercise A — Evaluating "Superpowers" (Claude Code plugin)

Real install, not a simulated one: `claude plugin install superpowers@claude-plugins-official`
→ succeeded, user scope, v6.2.0.

## What does it do?

A skills library that encodes a specific software-development *methodology* —
14 skills covering brainstorming/requirements refinement, strict red-green-refactor
TDD, a 4-phase systematic debugging process, parallel sub-agent dispatch, git
worktree usage, and code-review protocols. Unlike a single-purpose skill (our
own `scaffold-endpoint`), this is a whole opinionated workflow, not one task.

## How does it integrate with the workflow?

- **Install itself was frictionless** — one command, clean confirmation,
  transparent output: `claude plugin details superpowers` shows exactly which
  14 skills, their token cost at rest (~688 tokens always-on) and on-invoke
  (ranges from ~800 to ~10.3k tokens per skill). That transparency is
  genuinely better than our own skill's documentation — we never quantified
  `scaffold-endpoint`'s token cost.
- **It does NOT hot-reload into an already-running session.** I tried invoking
  `test-driven-development` immediately after installing — `Unknown skill`.
  New plugins need a session restart to register, exactly the same friction
  Day 3's MCP servers and Day 4's GitHub Actions workflow both had. This is
  now a confirmed *pattern* across three separate Claude Code subsystems
  (MCP, GitHub Actions, plugins), not a one-off quirk.
- Because of that, I did not force a full session restart to trial a skill
  live — doing so would have ended this conversation's context, which
  conflicts directly with actually finishing this exercise together.

## Genuinely useful, or just interesting?

**Interesting, with one genuinely useful idea worth stealing regardless of
adoption:** the per-skill token-cost transparency (`claude plugin details`)
is a real, useful pattern — it answers "what does this actually cost me" in
a way our own skill never has. The TDD/debugging *methodology* itself is
well-structured but overlaps heavily with disciplines this project's own
`CLAUDE.md` and `scaffold-endpoint` skill already enforce (layering,
verification-before-done, no premature abstraction) — for a project this
size, it's a second layer of process on top of one we already have, not a
gap it fills.

## Would I adopt it?

**Not for BookShelf, yes for a larger/team project.** For a solo learning
project with an already-tight `CLAUDE.md` and one custom skill, a 14-skill
methodology library is more process than the problem needs — matches the
mentor note's own warning: "a plugin that adds complexity without clear value
is worse than no plugin." It would earn its place on a team project where the
TDD/code-review discipline needs to be *enforced* across multiple people, not
just remembered by one.

## Which principles from this week did this evaluation lean on?

- **Configuration transparency** (Day 3's core lesson) — `claude plugin
  details`'s token-cost breakdown is exactly the kind of visibility this
  week trained me to look for before adopting something.
- **Integration friction as real signal, not noise** (Days 3-4's worktree/MCP
  restart gotchas) — recognizing the "needs a restart" pattern immediately,
  instead of being surprised by it, is a direct product of hitting the same
  issue twice already this week.
- **Does it replace something I do, or add something new?** (Day 5's own
  evaluation framework) — the honest answer here is "adds a parallel version
  of something CLAUDE.md already does," which is the actual basis for the
  no-adopt-here verdict.
