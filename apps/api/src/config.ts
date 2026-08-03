import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `import.meta.url` is the ESM equivalent of `__filename`. There is no `__dirname`
 * in ES modules, so we derive it.
 */
const currentDir = path.dirname(fileURLToPath(import.meta.url)); // apps/api/src
const repoRoot = path.resolve(currentDir, '..', '..', '..'); // <repo>

export const config = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),

  /**
   * Where the JSON collections live.
   *
   * Overridable via `BOOKSHELF_DATA_DIR` so the test suite can point at a throwaway
   * temp directory instead of mutating the real seed data. Resolving paths from the
   * module's own location (rather than `process.cwd()`) means `npm run dev` works
   * the same whether you launch it from the repo root or from `apps/api`.
   */
  dataDir: process.env.BOOKSHELF_DATA_DIR
    ? path.resolve(process.env.BOOKSHELF_DATA_DIR)
    : path.join(repoRoot, 'data'),

  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** Cap on request body size — a trivial but real denial-of-service guard. */
  jsonBodyLimit: '100kb',
} as const;

export const isProduction = config.nodeEnv === 'production';
