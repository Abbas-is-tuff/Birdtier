import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` inlines everything into one HTML file (dist-single/index.html).
// `npm run build:pages` does the same into docs/ (served by GitHub Pages from main /docs).
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'pages';
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: { outDir: mode === 'pages' ? 'docs' : single ? 'dist-single' : 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  };
});
