import type { RequestHandler } from 'express';

/**
 * Minimal request logger — method, path, status, duration.
 *
 * Written by hand rather than pulling in `morgan` because it is nine lines and one
 * fewer dependency to audit. `res.on('finish')` fires once the response has been
 * flushed, which is the only point at which the status code is known.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      `[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs.toFixed(1)}ms)`,
    );
  });

  next();
};
