# Day 1 — Submission

**Name:** Abdullah
**Date:**
**Repo:**

---

## Checklist (from the Day 1 pack, §4)

- [ ] **BookShelf repo** — working monorepo, API scaffolded, ≥3 endpoints functional
      → *4 endpoints functional: `GET /api/books`, `GET /api/books/search`,
      `GET /api/books/:id`, `POST /api/books`*
- [ ] **Tool A log** — `notes/day1-tool-a-log.md` (drafted; fill in the "← your call"
      sections)
- [ ] **Tool B log** — `notes/day1-tool-b-log.md` (create it from
      `day1-tool-b-brief.md`)
- [ ] **Comparison, 3–5 bullets** — below
- [ ] **One sentence:** what would you do differently next time — below
- [ ] **Quick demo** — screenshot of the server starting and `GET /api/books`

---

## Verification evidence

Paste real output. Screenshots are better than transcription.

**1. Server starts**

```
$ npm run dev

```

**2. `GET /api/books` returns seed data**

```
$ curl -s http://localhost:3000/api/books | head -40

```

**3. `POST` persists to the JSON file**

```
$ curl -s -X POST http://localhost:3000/api/books \
    -H 'content-type: application/json' \
    -d '{"title":"The Three-Body Problem","author":"Liu Cixin","genre":"Science Fiction","year":2008}'

$ tail -15 data/books.json

```

**4. Search by title works**

```
$ curl -s 'http://localhost:3000/api/books/search?q=dune'

```

**5. Test suite**

```
$ npm test

```

---

## Comparison: Tool A vs Tool B (3–5 bullets)

> Fill these in after Part 2. The mentor notes say the red flag is *"Reflection is
> 'It was great, AI is amazing' with no specifics"* — so name files, name the specific
> wrong decision, name what you had to type to fix it.
>
> Skeletons below are based on what actually happened in Part 1. Confirm or contradict
> them from your own Part 2 experience; do not submit them unedited.

- **Scaffolding — Tool A, decisively, and not close.** From one prompt plus an
  attachment it produced 24 files across three workspaces, including a layered
  architecture, a Zod schema package and 20 tests nobody asked for. <Tool B> was not
  given the chance to scaffold, and that asymmetry is itself the finding: an agentic
  CLI that can create directories and run commands operates at a different unit of
  work than an in-editor assistant.
- **Implementing a specific endpoint inside an existing codebase — <Tool B / Tool A>,
  because <…>.** *(This is the fair fight. Judge it on: did it read the neighbouring
  files first? Did it match `mutateCollection`, the `AppError` subclasses, the
  `{ data }` envelope? Or did it produce technically-working code in a style foreign
  to the rest of the repo?)*
- **Where Tool A needed the most correction: unrequested scope, and one confidently
  wrong domain fact.** It added pagination, sort, weighted search ranking, `/health`,
  a request logger and 409-on-duplicate-ISBN, none of which are in the Day 1 brief.
  It also set the minimum publication year to 1450 "because printing press" while
  simultaneously seeding a text from 180 CE. The lesson is not "AI is unreliable" —
  it is that *plausible-sounding domain constraints are the hardest class of error to
  catch on review*, because they read like expertise.
- **Where <Tool B> needed the most correction: <…>.** *(Check the five traps in
  `day1-tool-b-brief.md`.)*
- **Context is the whole game.** Tool A got the framework, folder layout and data
  shape right on the first attempt for exactly one reason: the full spec was in the
  prompt. Where the spec was silent — runner, validation library, response envelope —
  it invented reasonable answers I never approved. Every one of those inventions is
  now a convention the rest of the week has to live with. *(This is the setup for
  Day 2's `CLAUDE.md`: writing down those conventions is what stops tool #3 from
  inventing a different set.)*

---

## One sentence: what would you do differently next time?

> Suggested, edit freely:

I would spend five minutes writing down the decisions I *don't* care about (runner,
validation library, response shape) as explicit constraints up front, because leaving
them unstated didn't avoid the decision — it just meant the AI made it for me and I
found out afterwards.

---

## Questions for my mentor

-
-
