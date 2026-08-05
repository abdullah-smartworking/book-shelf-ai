import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The API base URL is deliberately NOT baked into the bundle. The app fetches
 * relative `/api/...` URLs and this dev-server proxy forwards them to the API, which
 * means:
 *
 *  - no CORS configuration on the Express side (same-origin from the browser's view),
 *  - no `VITE_API_URL` to get wrong per environment,
 *  - in production the same relative paths work behind any reverse proxy.
 *
 * Override the target when the API is not on the default port:
 *   BOOKSHELF_API_TARGET=http://localhost:3001 npm run dev:web
 */
const apiTarget = process.env.BOOKSHELF_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
