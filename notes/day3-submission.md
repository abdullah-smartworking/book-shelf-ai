# Day 3 — Submission

**Theme:** configuring your AI environment. Five exercises: rules across tools, a
custom skill, a sub-agent taster, MCP (connect + build), and a full-config feature
build.

**Read this before the rest:** two constraints shaped how these exercises were run,
and I'd rather state them up front than have them discovered mid-review.

1. This session is Claude Code itself, so Exercise A's three-way tool comparison
   (Claude Code / Cursor / Copilot) could only be run for real through Claude Code.
   See [day3-rules-comparison/comparison.md](day3-rules-comparison/comparison.md) for
   what that means for the write-up.
2. This session's execution sandbox has no working Node.js/npm at all — not a version
   issue, genuinely absent from `PATH` and every usual install location. Every file
   below was written and manually reviewed against the actual source it's supposed to
   match, but `npm install`, `npm test`, and `npm run typecheck` have **not** been run
   by me. §6 below has the exact commands to run and what they should show.

---

## Checklist

| ☐ | Item | Where |
|---|---|---|
| ✅ | Rules files: updated `CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md` | [`/CLAUDE.md`](../CLAUDE.md) · [`/.cursor/rules/`](../.cursor/rules/) · [`/.github/copilot-instructions.md`](../.github/copilot-instructions.md) |
| ⚠️ | Rules comparison across tools | [day3-rules-comparison/](day3-rules-comparison/) — Claude Code only, see note above |
| ✅ | Custom skill + test invocation | [`.claude/skills/scaffold-endpoint/`](../.claude/skills/scaffold-endpoint/) · [day3-skill-test/result.md](day3-skill-test/result.md) |
| ✅ | Sub-agent log | [day3-subagent/](day3-subagent/) |
| ⚠️ | MCP server: working code + verification log | [`apps/mcp-server/`](../apps/mcp-server/) · [`.mcp.json`](../.mcp.json) · [day3-mcp/](day3-mcp/) — code written, not yet run (needs `npm install` on your machine) |
| ✅ | Full config exercise: reviews feature + reflection | §5 below · [`apps/api/src/routes/books.routes.ts`](../apps/api/src/routes/books.routes.ts) · [`apps/web/src/pages/BookDetailPage.tsx`](../apps/web/src/pages/BookDetailPage.tsx) |
| ✅ | One sentence: biggest-impact mechanism | §7 below |

---

## 1. Exercise A — Rules across tools

**`CLAUDE.md`** — tightened, not rewritten: removed a paragraph of Architecture
elaboration that just restated what `jsonStore.ts`'s own doc comment already says,
added a "don't add `react-router-dom`" bullet (the single highest-value new line —
without it, any fresh AI session sees "book detail page" and reaches for a router by
reflex), corrected the MCP-server paragraph to match what actually got built (§4), and
kept the test count honest (41, not the stale 20).

**`.cursor/rules/`** — four `.mdc` files, split by concern rather than one dump of
`CLAUDE.md`: `general.mdc` (`alwaysApply: true`), `api.mdc`
(`globs: apps/api/**/*.ts`), `web.mdc` (`globs: apps/web/**/*.{ts,tsx}`), and
`scaffold-endpoint.mdc` (Cursor's answer to the skill — see §2).

**`.github/copilot-instructions.md`** — shorter and flatter than the Cursor files, per
the reading's own guidance that Copilot's instructions work best as short, direct
statements rather than long structured context.

### 1.1 The test

Ran `Add a DELETE /api/books/:id endpoint...` (full prompt in
[day3-rules-comparison/prompt.md](day3-rules-comparison/prompt.md)) through Claude
Code with all three rule files present. Full comparison, including what I'm
*predicting* rather than claiming for Cursor/Copilot, is in
[day3-rules-comparison/comparison.md](day3-rules-comparison/comparison.md).

> The rules' measurable effect wasn't in code style — Day 2's `CLAUDE.md` experiment
> already found the existing code comments carry that on their own. It was in one
> scope decision no code comment could answer: building a shelves cascade nobody
> asked for, versus flagging that it can't be done cleanly yet. That's the second time
> this course has found "don't widen scope" to be where a rules file actually earns
> its keep on this codebase, not convention-following.

---

## 2. Exercise B — Custom skill

[`.claude/skills/scaffold-endpoint/SKILL.md`](../.claude/skills/scaffold-endpoint/SKILL.md) —
encodes the six-step build order (schema → repository → service → route → wire-up →
test) already implicit across `books.routes.ts`/`books.service.ts`/`books.repository.ts`,
plus the hard constraints and anti-patterns the reading files (route-ordering, no
`asyncHandler`, field-by-field construction) call out as the specific mistakes AI tools
make on this exact codebase.

**Tested by invoking it for real** to scaffold `POST`/`GET /api/books/:id/reviews` —
not a dry run; this produced the actual reviews feature now in the repo. Full
step-by-step trace in [day3-skill-test/result.md](day3-skill-test/result.md).

> The skill's most valuable section wasn't the numbered steps — it was the "reference
> example, copied verbatim" block at the bottom. A real, working example from this
> exact codebase did more work than any instruction about *what* to do.

---

## 3. Exercise C — Sub-agent intro

**Main session:** implemented `PUT /api/books/:id` (`updateBookSchema` in
`packages/shared/src/book.ts`, `update()` in `books.repository.ts`, `updateBook()` in
`books.service.ts`, the route in `books.routes.ts`) —
deliberately **not** `createBookSchema.partial()`, because several of that schema's
fields carry `.default(...)`, and Zod applies a default whenever a key is absent; a
naive `.partial()` would silently reset an omitted `description`/`isbn`/`coverUrl` to
its create-time default on every update instead of leaving it untouched.

**Sub-agent, running concurrently:** delegated writing gap-coverage tests for the
search endpoint. Full prompt and result assessment in
[day3-subagent/](day3-subagent/). The short version: the course's suggested brief
("Jest tests... mock the data access layer") is wrong for this project on both counts,
so the delegated task was rewritten to match this repo's actual test convention before
handing it off — and the result needed zero corrections after that.

> The delegation worked well specifically because the task was both independent *and*
> fully answerable from the codebase alone — the sub-agent verified `q=''`'s rejected
> behaviour and confirmed special characters can't crash a plain substring scan by
> reading the actual schema and service code, not by guessing. Independence without
> that made it well-specified; a vaguer brief on the same task would not have gone
> as cleanly.

---

## 4. Exercise D — MCP: connect & build

Filesystem MCP registered via `npx -y` (no new dependency). GitHub MCP skipped — needs
auth only you can provide, and the brief treats it as the less load-bearing of the two
pre-built servers. Full custom BookShelf MCP server built:
[`apps/mcp-server`](../apps/mcp-server) — `query_books`, `get_book_stats`,
`get_shelf_contents`, reading `data/*.json` directly rather than importing
`apps/api`'s services (a deliberate, documented deviation from `CLAUDE.md`'s original
wording — see [day3-mcp/setup-log.md](day3-mcp/setup-log.md) for the reasoning).

**This is the one exercise I genuinely cannot mark "done" myself** — `@modelcontextprotocol/sdk`
needs `npm install`, and this session has no Node.js to run it, restart Claude Code
with the new `.mcp.json`, or call the tools. [day3-mcp/client-transcript.md](day3-mcp/client-transcript.md)
has the exact commands; please run them and let me know what comes back so I can fix
anything that doesn't work (most likely candidate: the SDK's API has shifted versions
before, so `tsc` may flag a mismatch in `apps/mcp-server/src/index.ts`'s import paths).

---

## 5. Exercise E — Full project config

**Backend:** the reviews feature (§2) built via the skill.
**Frontend:** a book detail page, reachable by clicking any card —
[`BookDetailPage.tsx`](../apps/web/src/pages/BookDetailPage.tsx),
[`ReviewCard.tsx`](../apps/web/src/components/ReviewCard.tsx),
[`ReviewForm.tsx`](../apps/web/src/components/ReviewForm.tsx),
[`useBookDetail.ts`](../apps/web/src/hooks/useBookDetail.ts). `App.tsx` switches
between the catalogue and detail views with one `useState<string | null>` — no router
added, per the codebase's own explicit stance from Day 2 ("deliberately not added
today, since one page does not need one"), now also codified in `CLAUDE.md` and
`web.mdc` so it survives past this session.

**MCP wasn't used to build the frontend** the way the brief suggests ("ask the AI to
create the reviews component... it can see what fields exist... without you pasting
anything") — the MCP server didn't exist as a *running, connected* tool yet when this
UI was built, only as source code (§4). The honest sequencing here is: skill → reviews
backend → frontend built against the now-real API contract (`BookWithReviews`,
`CreateReviewInput` — both already-defined shared types) rather than against a live
MCP query. Worth trying for real once §4's verification is done: ask Claude Code to
describe the reviews UI using `query_books`/`get_book_stats` and see whether it changes
anything about the component.

### 5.1 Reflection — this session vs. Day 1

Day 1's exercise was "give it the bare minimum, `Add a search endpoint to my API`" vs.
a fully-specified prompt — Day 2 measured that gap directly (1/5 vs 5/5, see
[day2-submission.md §1](day2-submission.md#1-exercise-a--context-showdown)). Today's
comparison is different in kind: it's not "more context in one prompt" but "context
and workflow encoded once, reused automatically."

- **Rules removed the need to restate conventions per-prompt.** Every endpoint built
  today (`PUT`, `DELETE`, both reviews routes) used the `{ data }`/`{ error }`
  envelope, `mutateCollection()`, and the layering rule without any of that being
  repeated in a task-specific prompt — it's ambient now, the way Day 2 predicted a
  `CLAUDE.md` would be.
- **The skill turned a 6-step build order into an invocation.** Day 1/2 endpoints were
  built prompt-by-prompt, each one re-deriving "where does validation go, what does the
  repository need to do." The reviews endpoints were the first ones built by naming a
  skill and a task, not by re-explaining the architecture.
- **The sub-agent was the first time two unrelated pieces of work happened at once**
  instead of sequentially — a difference in *throughput*, not quality, and only
  available because the two tasks were genuinely independent (§3).
- **What didn't change:** the same judgment calls Day 1/2 required are still required —
  whether to cascade a delete into shelves, whether `q=''` should mean "match nothing"
  or "match everything," whether the MCP server should reuse `apps/api`'s services or
  read the files directly. None of today's configuration made those decisions; it made
  *acting* on them faster and more consistent once made.

> Rules, skills, and sub-agents compound the same lever Day 2 found — context quality —
> rather than replacing it. What they add is that the context now has to be authored
> and reasoned about only once, not once per prompt.

---

## 6. Verification — what you need to run

Everything below needs a real Node.js, which this session's sandbox doesn't have:

```bash
npm install         # picks up @modelcontextprotocol/sdk (new) and apps/mcp-server
npm run typecheck   # all workspaces, including the new apps/mcp-server
npm test            # 41 cases: books.test.ts (28), reviews.test.ts (8), search.test.ts (5)
./scripts/smoke.sh  # end-to-end curl check
```

Then §4's MCP-specific steps in
[day3-mcp/client-transcript.md](day3-mcp/client-transcript.md) (Inspector check, then
a real Claude Code restart + tool-call test).

Please paste back anything that fails — in particular the `@modelcontextprotocol/sdk`
import paths in `apps/mcp-server/src/index.ts` are the one place I flagged real version
risk, since I couldn't check them against an installed copy of the package.

---

## 7. One sentence

The **skill** had the biggest impact on workflow today — rules shape *how* code looks
once you're writing it and MCP shapes *what data* the AI can see, but the skill is the
only mechanism that collapsed a whole multi-file, six-step build order (schema →
repository → service → route → wire-up → test) into a single invocation, which is
exactly the kind of repeated, structural task (a new endpoint) this project generates
most often.
