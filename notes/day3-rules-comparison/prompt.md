# Rules cross-tool test — prompt used

Run against a repo that already had all three rule files committed: `CLAUDE.md`
(refined), `.cursor/rules/{general,api,web,scaffold-endpoint}.mdc`, and
`.github/copilot-instructions.md`.

```text
Add a DELETE /api/books/:id endpoint. Should return 404 if the book doesn't exist.
Remove the book from any shelves that contain it.
```
