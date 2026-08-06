# Exercise A — rules across tools: comparison

**Honest scope note, agreed with the mentor before running this:** this session is
Claude Code itself — there is no way for me to drive Cursor or GitHub Copilot from
inside this conversation. So this is **not** the three-way comparison the brief
describes. It's one real run through Claude Code, with all three rule files already
committed, plus a design-level read of the other two files. If Cursor/Copilot are
installed, re-running [prompt.md](prompt.md) in each and dropping the transcript
into this folder would complete the exercise for real.

## What Claude Code (this session) actually did

Ran the prompt above with `CLAUDE.md`, the four `.cursor/rules/*.mdc` files, and
`.github/copilot-instructions.md` all present. Result — see
[`apps/api/src/routes/books.routes.ts`](../../apps/api/src/routes/books.routes.ts),
[`apps/api/src/services/books.service.ts`](../../apps/api/src/services/books.service.ts)
(`deleteBook`), [`apps/api/src/data/books.repository.ts`](../../apps/api/src/data/books.repository.ts)
(`remove`), and the `DELETE /api/books/:id` block in
[`apps/api/tests/books.test.ts`](../../apps/api/tests/books.test.ts):

| Rule | Followed? |
|---|---|
| `{ data }` / `{ error }` envelope, `204` on delete | ✅ |
| Repository → service → route layering, no `try/catch` | ✅ |
| Removal via `mutateCollection()`, not read+write | ✅ |
| `NotFoundError` thrown from the service, not the route | ✅ |
| `node:test`, not Jest, isolated temp `BOOKSHELF_DATA_DIR` | ✅ |
| No new npm dependency | ✅ |

**The interesting part is the part it did *not* do:** "remove the book from any
shelves that contain it." There is no shelves repository/service/route anywhere in
this codebase — only a seeded `data/shelves.json` nothing else touches. Rather than
inventing a shelves feature to satisfy the cascade, the rule
`.cursor/rules/general.mdc` / `CLAUDE.md` both state ("Don't widen scope... flag
anything you think is missing instead of adding it unasked") was followed: the
cascade is explicitly skipped with a code comment on `deleteBook` explaining why,
and `CLAUDE.md`'s Known Limitations section was updated to say so. That's the rule
actually earning its keep — a generic "add a DELETE endpoint" prompt gives no signal
either way, so the only thing steering that decision was the rules file.

## What I'd predict for Cursor / Copilot, and why I'm not asserting it as fact

Per the course's own mentor notes (Day 3, "What to expect"): Claude Code tends to
respect rules most consistently because it reads the whole file as context; Cursor's
scoped `.mdc` files tend to do about as well since `api.mdc`'s glob
(`apps/api/**/*.ts`) matches exactly the files this task touches; Copilot's
instructions file has less leverage over agentic edits and more over chat/inline
completions specifically. I'm recording this as the course's stated expectation, not
as something I verified — the previous day's `CLAUDE.md` experiment
([day2-submission.md §2.1](../day2-submission.md#21-does-it-work--tested-with-delete-apibooksid-against-a-control))
already found that on *this* codebase, well-commented code alone got a control run
(no rules file at all) to follow layering/envelope conventions just as well — the
rules files' real value on this repo has consistently been in **scope decisions**
(what to build), not **convention-following** (how to build it), and that pattern
held again here.

> The measurable difference these rules made wasn't in code style — the existing
> comments already carry that. It was in the one decision no code comment could
> answer: whether "remove from shelves" was something to build or something to flag.
