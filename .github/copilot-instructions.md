# BookShelf — Copilot instructions

TypeScript npm-workspaces monorepo. Express 5 API (`apps/api`), React 19 + Vite +
Tailwind frontend (`apps/web`), Zod schemas in `packages/shared`. No database — JSON
files in `/data`. Tests are `node:test` via `tsx --test`, not Jest.

- Layer API code `routes/` → `services/` → `data/`. Never HTTP in a service, never a
  file read outside `data/`.
- No `try/catch` or `asyncHandler` in Express route handlers — Express 5 forwards
  rejected promises automatically.
- Register `/search` before `/:id` in any router — literal routes before params.
- Validate everything with a Zod schema from `packages/shared` + `parseOrThrow`.
- Response shape: `{ data }` on success, `{ error: { code, message } }` on failure.
  Never a bare array or a bare 200 with no envelope.
- Writes go through `mutateCollection()`, never a bare read+write pair.
- Frontend has no router — use React state, not `react-router-dom`.
- Frontend fetches only through `lib/api.ts`'s `fetchJson`; Tailwind only, no new CSS.
- Don't add an npm dependency without saying so first.
- Don't touch `/data/*.json` by hand.
