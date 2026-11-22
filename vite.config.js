import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { pages } from './plugins/pages.js';

export default defineConfig({
  plugins: [pages()],
  server: { port: 5173, strictPort: false, watch: { ignored: ['**/tests/**'] } },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), walk: resolve(__dirname, 'monitor/walk.html'), cv: resolve(__dirname, 'cv.html') },
    },
  },
});
