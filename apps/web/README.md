# @bookshelf/web — placeholder

**Intentionally empty on Day 1.** The Day 1 brief says explicitly:

> You are NOT building the frontend today. That starts on Day 2.

This directory exists only so the monorepo matches the shape in the project spec.
It contains no `package.json`, so npm's `workspaces: ["apps/*"]` glob skips it and
`npm install` stays fast.

## Day 2 will add

```
apps/web/
├── src/
│   ├── components/   # UI components
│   ├── pages/        # Page-level components
│   ├── hooks/        # Custom hooks
│   └── lib/          # API client, utilities
├── tests/
└── package.json
```

The API client in `src/lib` will import types and Zod schemas straight from
`@bookshelf/shared`, so the form validation in the "Add book" page reuses the exact
`createBookSchema` the API validates against.
