import { defineConfig } from 'vite';
import { resolve } from 'path';

// Service Worker build config
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/service-worker/index.ts'),
      name: 'serviceWorker',
      formats: ['es'],
      fileName: () => 'service-worker.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'service-worker.js',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
