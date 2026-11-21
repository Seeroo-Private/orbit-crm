import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      // dev only: serve the static landing page at /welcome/ instead of the SPA shell
      name: 'welcome-landing',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/welcome' || req.url === '/welcome/') req.url = '/welcome/index.html';
          next();
        });
      },
    },
  ],
  server: { port: 5180, strictPort: true, proxy: { '/api': 'http://localhost:4100' } },
});
