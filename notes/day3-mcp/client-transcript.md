# Exercise D — MCP: verification steps (run these yourself)

These need to run on your machine, not in this session — see
[setup-log.md](setup-log.md) for why.

## 1. Install the new dependency

```bash
npm install
```

This picks up `@modelcontextprotocol/sdk` (new, in `apps/mcp-server/package.json`) and
`@bookshelf/mcp-server` as a workspace. Watch for a version-mismatch error on the SDK
import paths (`@modelcontextprotocol/sdk/server/mcp.js`,
`@modelcontextprotocol/sdk/server/stdio.js`) — the SDK's API has shifted across
versions; if `apps/mcp-server/src/index.ts` doesn't typecheck against whatever version
`npm install` resolves, that's the first thing to check.

## 2. Typecheck the new workspace

```bash
npm run typecheck
```

Should now cover `apps/mcp-server` too, since it's picked up by the `apps/*` workspace
glob automatically — no root `package.json` change was needed.

## 3. Smoke-test the server standalone, without Claude Code

```bash
npx @modelcontextprotocol/inspector npx tsx apps/mcp-server/src/index.ts
```

This opens the standard MCP Inspector UI. Confirm all three tools
(`query_books`, `get_book_stats`, `get_shelf_contents`) are listed, then call each one:
- `query_books` with `{ "genre": "Science Fiction" }`
- `get_book_stats` with `{}`
- `get_shelf_contents` with `{}`

## 4. Load it into Claude Code for real

`.mcp.json` is already committed at the repo root. Restart Claude Code (or run `/mcp`
to reload) — a new/changed `.mcp.json` doesn't take effect mid-session. Then ask:

```
What MCP tools do you have available?
```

Expect `bookshelf`'s three tools plus the `filesystem` server's tools listed. Then try:

```
How many Science Fiction books are in the catalogue, and what's the most recently added book overall?
```

Watch whether it calls `query_books`/`get_book_stats` rather than reading
`data/books.json` by pasting it — that's the actual point of the exercise (the AI
querying live data through a tool call instead of you copying a file into the prompt).

## 5. Run the full test suite once, now that PUT/DELETE/reviews exist

```bash
npm test           # apps/api — 41 cases across books/reviews/search test files
npm run typecheck  # all workspaces
./scripts/smoke.sh  # if you want the curl-based end-to-end check too
```

Paste back any failures — I can't run these myself in this session (see
[setup-log.md](setup-log.md)), so this is the one place where "done" genuinely depends
on you confirming it.
