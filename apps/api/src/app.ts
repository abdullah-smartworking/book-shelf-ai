import express, { type Express } from 'express';

import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './routes';

/**
 * Builds the Express app without starting a server.
 *
 * Separating "assemble the app" from "listen on a port" (`index.ts`) is what lets
 * the test suite spin up an app on an ephemeral port, or several isolated apps at
 * once, with no port conflicts and no global state.
 *
 * Middleware order below IS the request pipeline, top to bottom.
 */
export function createApp(): Express {
  const app = express();

  // Don't advertise the framework. Free, tiny reduction in fingerprinting.
  app.disable('x-powered-by');

  // 1. Parse JSON bodies, with a size cap. Must come before any route that reads
  //    `req.body`, otherwise `req.body` is `undefined`.
  app.use(express.json({ limit: config.jsonBodyLimit }));

  // 2. Log. After the parser so a malformed body still gets logged with its status.
  app.use(requestLogger);

  // 3. Liveness probe, outside /api because it is infrastructure, not domain.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      dataDir: config.dataDir,
    });
  });

  // 4. The actual API.
  app.use('/api', apiRouter);

  // 5. Nothing matched → JSON 404 (not Express's default HTML page).
  app.use(notFoundHandler);

  // 6. Error handler LAST. Express only routes errors to middleware registered
  //    after the code that threw.
  app.use(errorHandler);

  return app;
}
