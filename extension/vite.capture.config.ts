import { defineConfig } from 'vite';
import { resolve } from 'path';

// Main-world capture script (IIFE)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content-script/capture.ts'),
      name: 'captureScript',
      formats: ['iife'],
      fileName: () => 'capture.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'capture.js',
        extend: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
