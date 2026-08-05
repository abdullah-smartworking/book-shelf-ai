# Day 2 — Submission

**Theme:** prompting & context. Three exercises: a context showdown, `CLAUDE.md`, and the
start of the frontend.

Everything below was actually run. Where I claim a number, the command that produced it
is named so it can be re-run.

---

## Checklist

| ☐ | Item | Where |
|---|---|---|
| ✅ | Context Showdown Round 1 — prompt + output + score | [§1](#1-exercise-a--context-showdown) · [prompt](day2-context-showdown/round1-prompt.md) · [output](day2-context-showdown/round1-output.md) |
| ✅ | Context Showdown Round 2 — full prompt + output + score | [§1](#1-exercise-a--context-showdown) · [prompt](day2-context-showdown/round2-prompt.md) · [output](day2-context-showdown/round2-output.md) |
| ✅ | Comparison — 3–5 bullets on the measurable difference | [§1.4](#14-the-measurable-difference) |
| ✅ | `CLAUDE.md` committed — 8 sections, real content | [`/CLAUDE.md`](../CLAUDE.md) · [§2](#2-exercise-b--claudemd) |
| ✅ | Frontend scaffolded — catalogue page rendering books from the API | `apps/web` · [§3](#3-exercise-c--the-frontend) |
| ✅ | Design comparison notes | [day2-frontend/comparison.md](day2-frontend/comparison.md) |

---

## 1. Exercise A — Context Showdown

**Task:** add `GET /api/books/search?q=` searching title, author and genre,
case-insensitively.

### 1.0 A problem with running this honestly

Day 1 already built this endpoint. Re-running the exercise on code that exists would be
theatre — the answer is sitting in the repo.

So I built a **search-removed snapshot** of the Day 1 repo: the `/search` route, the
`searchBooks` service, `searchBooksQuerySchema`, the search response types and the four
search tests were stripped out. The snapshot is a genuine pre-search Day 1 repo —
verified at **16/16 tests passing, typecheck clean** before either round ran.

**Method — the prompt is the only variable.** Same model, same task, same session.
Neither round had repository access, so neither could cheat by reading the answer; both
had to produce code from their prompt alone. I then applied each output to a copy of the
snapshot myself and measured it.

*One caveat I should name:* both agents could see my `MEMORY.md` index line, which says
"BookShelf — AI course assignment, Day 1 backend built". It names no language, framework
or stack. It nudged Round 1 toward "this is a backend project" and nothing more.

### 1.1 Round 1 — poor context

**Prompt, in full — 7 words:**

```text
Add a search endpoint to my API.
```

**What came back:** 270 lines of **Python**. FastAPI + SQLAlchemy 2.0 + Pydantic v2, with
a `WHERE ... ILIKE` filter, `app/routers/search.py`, `app/schemas/search.py`, and eight
pytest cases.

The project is TypeScript and Express. It guessed the language wrong.

It invented, and told me it was inventing:

- a `Book` **SQLAlchemy model** with a `published_year` column (our field is `year`)
- a `get_db` dependency, a `BookRead` schema, an `app/routers/` layout
- sync `Session` over `AsyncSession`
- a `client` pytest fixture and a `POST /books` route to build test data
- its own envelope: `{query, total, limit, offset, items}`
- `422` for a missing `q` (FastAPI's default)

**Score: 1/5.**

The course predicts 2–3 for Round 1. I am going lower, and the reason is specific: this
was a coin-flip on language that landed wrong, so **0% of the artifact was usable.** Had
it guessed Express, the same output would have been a 3.

What is worth saying in its defence, because it complicates the tidy story: **the
reasoning was not bad.** Unprompted, it warned that `/search` must be registered before
`/{book_id}` or the wildcard would swallow it — the single most important trap in this
task — and it flagged LIKE-wildcard escaping. It also disclosed every assumption instead
of hiding them.

> Poor context did not make the model stupider. It made the output inapplicable. The
> insight was transferable; the code was landfill.

### 1.2 Round 2 — rich context

**Prompt: 2,648 words**, structured into the four blocks the exercise prescribes —
project overview, existing code (7 real files pasted), conventions, specific task +
constraints. Verbatim in [round2-prompt.md](day2-context-showdown/round2-prompt.md).

**What came back:** TypeScript, three files changed and one test file added, matching the
house style.

**Measured, not eyeballed** — its output applied to a snapshot copy:

| Check | Command | Result |
|---|---|---|
| Compiles under `strict` | `npm run typecheck` | **0 errors** |
| Meets the 5 stated requirements | [`acceptance.test.ts`](day2-context-showdown/acceptance.test.ts) | **15/15 pass** |
| Breaks nothing that existed | `tsx --test tests/books.test.ts` | **16/16 still pass** |
| Manual fixes needed to integrate | — | **0 files edited** |
| New npm dependencies | — | **0** |

The acceptance suite was written from the exercise brief *before* I looked at either
output, so it is a fixed yardstick, not a rubber stamp shaped to fit the winner.

**It also found a bug in my existing code.** Day 1's `normalise()` carries the comment
`/** Case- and accent-insensitive comparison key. */` over a body of
`value.trim().toLowerCase()`. `.toLowerCase()` does not fold diacritics. Verified:

```
node -e '"José".toLowerCase().includes("jose")'   // → false
```

The comment has been wrong since Day 1 and no test caught it, because no seed book has an
accented author name that anyone searches for. Round 2 read the file, noticed the comment
contradicted the code, and corrected the comment rather than silently widening behaviour.

**Score: 5/5**, with two honest deductions that did not cost it a point:

- it put its test file in `src/services/` rather than `tests/`, so `npm test` (glob
  `tests/*.test.ts`) would not pick it up — **my fault**: I never pasted `package.json`,
  so it could not know the glob.
- it extended search to inherit the list endpoint's `genre`/`author`/`year`/`sort`/`page`
  params. Defensible (prevents drift) but slightly beyond the brief.

### 1.3 Cost

The rich prompt took me about 20 minutes, most of it pasting files. It replaced a
complete rewrite. **7 words → 1/5. 2,648 words → 5/5.**

### 1.4 The measurable difference

1. **Wrong language, not just wrong style.** Round 1 produced Python/FastAPI/SQLAlchemy
   for a TypeScript/Express/Zod project — 270 lines, 0% applicable, a full rewrite.
   Round 2 applied verbatim: **0 files edited, `tsc` clean first try.**
2. **15/15 vs 0/15 on a fixed acceptance suite.** Round 2 passed every requirement.
   Round 1 scored zero not because its logic was wrong but because it **could not be
   executed at all** in this project.
3. **Conventions are unguessable.** Round 1 invented `{query, total, limit, offset, items}`
   and `422`s. Round 2 returned the house `{ data, meta }` envelope and
   `400 VALIDATION_ERROR` — because the envelope was in the prompt. No amount of
   model quality substitutes for being told.
4. **Round 2 fixed a latent bug in my code; Round 1 structurally could not.** Reading the
   real `normalise()` is what surfaced the false accent-insensitivity comment. Context
   does not just improve output — it lets the AI audit what you already have.
5. **Assumptions collapsed from eight to zero.** Round 1 listed 8+ invented facts about
   my codebase. Round 2 listed none, only deliberate deferrals *with reasons*
   (no relevance ranking, no accent folding) — decisions handed back to me instead of
   made silently.

---

## 2. Exercise B — `CLAUDE.md`

[`/CLAUDE.md`](../CLAUDE.md) — **107 lines, 8 sections**, all filled with real BookShelf
detail rather than the template's placeholders.

Sections: Project Overview · Tech Stack · Commands · Architecture · Conventions ·
Data Layer · What NOT to Do · Known Limitations.

**Where I deliberately diverged from the appendix template:**

- The template says `Tests: Jest`. **We do not use Jest** — it is `node:test` via
  `tsx --test`. Left unfixed, that line would make every future AI write Jest syntax
  against a runner that cannot execute it. This is the single highest-value edit in the
  file.
- Added **Commands**, because "how do I run the tests" is the question an agent most
  often guesses wrong.
- Added **Known Limitations**, kept deliberately unflattering: the write mutex is
  in-process only; there is no auth; seed data is never validated against
  `createBookSchema`; `PUT`/`DELETE`, shelves and reviews are unimplemented. The exercise
  asks for honest, not aspirational — a context file that oversells the codebase is worse
  than none, because the AI will trust it.
- Three **load-bearing traps** are stated as prohibitions with the consequence attached,
  because each is silent when broken: don't register `/search` after `/:id`; don't remove
  the unused `_next` from the error handler (`fn.length === 4` is how Express recognises
  it); don't reach for `asyncHandler` (that's Express 4 pattern-matching).

### 2.1 Does it work? — tested with `DELETE /api/books/:id`, against a control

The exercise says: use `CLAUDE.md` as context, ask the AI to add `DELETE /api/books/:id`,
and see whether it follows your patterns. A single run cannot answer that, because you
cannot tell what the file contributed and what the AI would have done anyway.

So I ran it **twice, in identical throwaway copies of the repo**, with one instruction —
`Add DELETE /api/books/:id` — and nothing else:

- **A: with `CLAUDE.md`**
- **B: control, `CLAUDE.md` deleted**

Both had full repository access, as Claude Code normally would.

#### The result I did not expect

**The two implementations are near-identical, and the control followed every convention.**
I diffed them file by file. Both:

| | A (with) | B (control) |
|---|---|---|
| `200` + `{ data: <deleted book> }`, not `204` | ✅ | ✅ |
| Removed via `mutateCollection()`, not read+write | ✅ | ✅ |
| `NotFoundError` thrown **inside** the mutator | ✅ | ✅ |
| No status codes in the service | ✅ | ✅ |
| No `try/catch`, no `asyncHandler` | ✅ | ✅ |
| Layering route → service → repository | ✅ | ✅ |
| Tests added to the existing suite, `node:test` | 7 (27/27) | 6 (26/26) |
| npm dependencies added | 0 | 0 |
| Typecheck | clean | clean |

The control reached the same answers by **reading the code comments Day 1 left behind**.
It quoted `books.repository.ts` on why the duplicate-ISBN check lives inside the mutator,
`jsonStore.ts` on nothing being written when a mutator throws, the `⚠️ ORDER IS
LOAD-BEARING` comment, and `api.ts` on the single-envelope contract.

> On this codebase, `CLAUDE.md` did **not** measurably improve convention-following —
> because the conventions were already written down, in the place the AI was already
> looking. Well-commented code is itself a context file.

That is not the result the exercise predicts, and I am reporting it rather than the
tidier version.

#### Where `CLAUDE.md` *did* change behaviour: scope

The one substantive divergence is **cascade deletion of reviews**:

- **B (control) built the cascade** — added `removeByBookId()` to
  `reviews.repository.ts` and called it from `deleteBook()`. Its reasoning was good, and
  it is a real bug it found: because `nextBookId()` derives the next id from the highest
  id *currently in the file*, deleting the newest book frees its id, so **a newly created
  book can inherit a deleted book's reviews** — which `GET /api/books/:id` then embeds.
  It verified this live.
- **A (with `CLAUDE.md`) found the same bug and refused to fix it**, citing
  "Don't widen scope — flag anything you think is missing instead of adding it unasked."
  It documented orphaned reviews and id reuse as known limitations and handed the
  decision back to me.

Both behaviours are defensible, and the honest reading is uncomfortable:

**My "don't widen scope" rule suppressed a correct bug fix.** It did exactly what I wrote
it to do — Day 1's failure was unrequested pagination, ranking and `/health`, and this is
the fix for that. But the same rule stopped an agent from fixing a genuine correctness
issue it had independently discovered.

The rule survives because of its second half: *flag what you are not doing.* A restrained
agent that silently drops the problem would be strictly worse than the control. A
restrained agent that surfaces it and lets me choose is what I actually want. The
takeaway is that **"don't widen scope" is only safe when paired with "tell me what you
found"** — and it is worth checking that the pairing actually holds, because half of that
rule is doing all the work.

#### One thing to watch

A **edited `CLAUDE.md` itself** — bumped the test count 20 → 27, moved `DELETE` out of the
"not yet implemented" list, and added two Known Limitations bullets. Every edit was
factually correct, it flagged them rather than hiding them, and it touched no rules. Still:
an agent editing its own instruction file is a pattern to keep an eye on. It also
regressed one line I had just fixed by hand (`Vite 8` → `Vite 7`), which is a reminder
that an agent's copy of a file can go stale mid-session.

**Scope note:** both runs were throwaway. **`DELETE` is deliberately not in the repo** —
it is not a Day 2 deliverable, and merging it because a tool happened to write it is the
Day 1 mistake again. Both implementations exist in the scratch trees; the control's
cascade version is the better of the two if we decide to pull one in.

---

## 3. Exercise C — the frontend

`apps/web` — React 19 + Vite 8 + Tailwind CSS 4, in the folder shape the project spec
specifies (`components/`, `pages/`, `hooks/`, `lib/`).

**Verified running:**

| Check | Result |
|---|---|
| `npm run typecheck` (3 workspaces) | 0 errors |
| `npm run build` | ✅ 24 modules, 198 kB JS / 20.6 kB CSS |
| `npm test` (API) | 20/20 |
| `./scripts/smoke.sh` | 16/16 |
| Catalogue renders 30 books from the API | ✅ |
| Search `?q=ishiguro` → 2 hits, "matched on author" | ✅ |
| Light / dark / mobile 375px | ✅ all three |
| Browser console | no errors |

```bash
npm run dev       # terminal 1 — API on :3000
npm run dev:web   # terminal 2 — Vite on :5173
```

Full design comparison in
[day2-frontend/comparison.md](day2-frontend/comparison.md). The short version:

- **Part 1 (no design direction) was not ugly** — it independently chose a warm
  off-white page, serif titles, a card grid and dark mode. The expected "Bootstrap blue
  table" never materialised. Models have a default taste now.
- What direction actually bought was **control**: 22 explicit breakpoint utilities
  (1→2→3→4 columns) vs **zero media queries**; `max-w-7xl` vs a `60rem` cap wasting a
  quarter of a wide screen; a real card hover state vs **none**;
  `prefers-reduced-motion` honoured vs ignored.
- The biggest genuine win was not visual at all: Part 2 **imports `Book` from
  `@bookshelf/shared`**, where Part 1 redeclared it in a local 47-line `types.ts`. That
  duplicate would drift from the API and fail at runtime, not compile time. Pointing the
  AI at existing code beat describing what I wanted.

---

## 4. What I got wrong today

Two bugs I shipped, both in code I wrote to a detailed spec of my own:

1. **The dark palette applied in light mode.** I wrote
   `@media (prefers-color-scheme: dark) { @theme { … } }`. Tailwind v4 **hoists `@theme`
   out of the media query** and emits it unconditionally, so the dark tokens won in both
   schemes. It compiled, it built, `tsc` was silent, and the screenshot looked perfect —
   because my browser was in dark mode. Caught only by forcing light mode and reading the
   computed value of `--color-paper`.
2. **Two × buttons in the search field.** `<input type="search">` draws a native clear
   button in Chrome, next to my styled one. Invisible in the source, obvious on screen.

Neither is a context problem, and neither would have been caught by a better prompt.
Both needed a browser. Day 2's lesson is that context quality raises the ceiling on what
the AI aims at; it does nothing for verification, and verification is still mine.

**One sentence, what I would do differently:** write the reusable half of a brief into
`CLAUDE.md` the *first* time I need it rather than the third — Part 2's design brief was
~700 words, and only the durable third of it (tokens, mobile-first, no stray CSS) ended
up somewhere I will never have to retype.
