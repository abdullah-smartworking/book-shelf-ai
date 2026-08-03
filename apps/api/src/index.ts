import { createApp } from './app';
import { config } from './config';

/**
 * Process entry point: start the HTTP server and shut it down cleanly.
 */
const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[api] BookShelf API listening on http://localhost:${config.port}`);
  console.log(`[api] environment: ${config.nodeEnv}`);
  console.log(`[api] data directory: ${config.dataDir}`);
  console.log('[api] try: curl http://localhost:%d/api/books', config.port);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[api] port ${config.port} is already in use. Stop the other process or run: PORT=3001 npm run dev`,
    );
    process.exit(1);
  }
  throw error;
});

/**
 * Graceful shutdown. `server.close()` stops accepting new connections and waits for
 * in-flight requests to finish — which matters here because a request could be
 * midway through writing books.json, and killing the process at that moment is
 * exactly the scenario the atomic write in `jsonStore.ts` protects against.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    // Don't hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
