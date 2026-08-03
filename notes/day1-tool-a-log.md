# Day 1 — Tool A Log

**Tool:** Claude Code (CLI, Opus 5)
**Session length:** one continuous session, no restarts
**Task:** scaffold the BookShelf monorepo + the four core book endpoints from the
Day 1 spec

> **How to use this file:** the *facts* below (what was prompted, what got produced,
> what was wrong) are recorded accurately. The sections marked **← your call** are
> judgements only you can make, and your mentor is explicitly looking for those.
> Fill them in yourself before submitting.

---

## 1. What I told it

**Prompt 1 — the spec dump.** The whole Day 1 `.docx` was attached, plus:

> "I am given this assignment on day 1 as part of my 5 days AI Intensive course…
> please help me understand the requirements by analysing the screenshot and then we
> will do things step by step."

Two screenshots of the course page were attached alongside the doc.

Notable: the first prompt asked for **analysis, not code**. That was the single
highest-leverage decision in the session — it forced the tool to state its
understanding of the requirements before writing anything, so a misreading would
have surfaced in a paragraph of prose instead of in 20 files.

**Prompt 2 — authorise the build, with a constraint.**

> "i have attached the doc required. you can start working/building. It explicitly
> says: 'NOT building today — Frontend starts on Day 2. Focus on the API and tooling
> comparison.' In the end please explain me everything, every detail, every code,
> what, why, how, etc. And let me know the next steps after that."

Re-stating the *negative* requirement (do not build the frontend) mattered. The spec
mentions React, `apps/web/`, `components/`, `pages/` and `hooks/` many times; a tool
pattern-matching on the document as a whole would plausibly have scaffolded Vite +
React. It did not, because the constraint was repeated in the prompt rather than left
buried on page 12 of the attachment.

**No third prompt was needed.** Everything below came out of prompt 2, autonomously.

---

## 2. What it produced

### Sequence of actions it chose by itself

1. Loaded a document-handling skill, then discovered `pandoc` was not installed.
2. **Recovered without being asked** — unzipped the `.docx` (a docx is a zip of XML),
   wrote a throwaway Python script to strip `<w:t>` text nodes out of
   `word/document.xml`, and read the 380-paragraph result.
3. Read the spec and restated the requirements as a table before writing any code.
4. Wrote 24 files.
5. Discovered Node.js was not installed on the machine and stopped to ask, rather
   than guessing at an install method that needed a password.

### Files created

```
package.json                 tsconfig.base.json          .gitignore
README.md
data/books.json              (30 books, 10 genres — AI-generated)
data/shelves.json            (4 shelves)
data/reviews.json            (9 reviews)
packages/shared/             package.json, tsconfig.json
  src/index.ts, book.ts, review.ts, shelf.ts, api.ts
apps/api/                    package.json, tsconfig.json
  src/index.ts               listen + graceful shutdown
  src/app.ts                 middleware pipeline
  src/config.ts              port, data dir, env
  src/errors.ts              AppError hierarchy
  src/routes/index.ts, books.routes.ts
  src/services/books.service.ts
  src/data/jsonStore.ts, books.repository.ts, reviews.repository.ts
  src/middleware/validate.ts, errorHandler.ts, requestLogger.ts
  tests/books.test.ts        20 integration tests
apps/web/README.md           deliberate placeholder
notes/                       this file + 2 others
```

### Choices it made without being asked

| Decision | What it chose | Was it in the spec? |
| --- | --- | --- |
| Language | TypeScript | Optional — spec says "either is fine, TS recommended" |
| Framework | Express 5 | Spec says Express ✅ |
| Runner | `tsx` (no build step) | Not mentioned — its own call |
| Validation | Zod, in `packages/shared` | Not mentioned — its own call |
| Test framework | `node:test` + `fetch`, zero deps | Spec only says a `tests/` dir should exist |
| Response shape | `{ data, meta }` / `{ error: { code } }` envelope | Not specified |
| Extras beyond brief | pagination, sort, weighted search ranking, `/health`, request logger, graceful shutdown, 409 on duplicate ISBN | **No — all unprompted scope** |

---

## 3. Where I intervened

Honest accounting — this is the section that matters most.

**A. Interventions I made in the prompt (before any code existed)**

1. **Re-stated "no frontend".** See prompt 2 above. Pre-empted the most likely
   failure mode rather than correcting it after the fact.
2. **Asked for analysis first, code second.** Turned a 20-file gamble into a
   reviewable paragraph.

**B. A bug the tool created and then caught itself**

`createBookSchema` originally rejected any `year` before **1450** — reasoning that
movable type did not exist earlier. Confident, plausible, and wrong: the seed
catalogue *it wrote in the same session* contains Marcus Aurelius' *Meditations*
(c. 180 CE). Two of its own outputs contradicted each other, and nothing in the
type system or the tests would have caught it, because the create-validator only
runs on `POST` and never on seed data.

It noticed while writing the seed file and lowered the floor to −800 with a comment
explaining why. Worth dwelling on: **the fix was self-initiated, but the bug was
self-inflicted, and the failure mode was exactly the one the Day 1 reading describes
— "confidence without competence".** A reviewer skimming a 30-file diff would very
likely have let `1450` through, because it *reads* like domain knowledge.

**C. The tool refused to guess at something it could not verify**

Node.js was absent. Instead of picking an install method, it stopped and asked. This
is the correct behaviour and also the boundary of its autonomy — anything requiring a
password is outside what it can do.

**D. What I did NOT intervene on ← your call**

> The route-ordering trap, the `mutateCollection` write lock, and the four-argument
> error handler are all correct in the code. Did you verify each one yourself, or
> take them on trust because the comment above them sounded authoritative?
> Answer honestly — "I trusted it" is a legitimate and useful data point.

---

## 4. What surprised me ← your call

Prompts for your own answer:

- It recovered from the missing `pandoc` by writing its own XML parser, without being
  told to. Did you expect that level of improvisation?
- It wrote **20 tests you never asked for**, including a five-way concurrent-POST
  race-condition test — while the mentor notes explicitly say *"don't worry about
  production-grade data access"*. Is unrequested rigour a feature or scope creep?
- It added pagination, sort, search ranking, a `/health` endpoint and 409-on-duplicate
  -ISBN, none of which are in the Day 1 brief. Would you have preferred it built
  exactly the six bullet points and stopped?
- It knew Express 5 forwards async rejections and therefore omitted `try/catch`
  everywhere. Would you have spotted that if it were wrong?

---

## 5. Verification evidence

```bash
npm install
npm test          # → paste the result here
npm run dev       # → screenshot the startup output here
```

```bash
curl -s http://localhost:3000/api/books | head -30
curl -s 'http://localhost:3000/api/books/search?q=dune'
curl -s -X POST http://localhost:3000/api/books \
  -H 'content-type: application/json' \
  -d '{"title":"Test Book","author":"Me","genre":"Technology","year":2025}'
```

Paste the outputs, or screenshot them, into the submission.
