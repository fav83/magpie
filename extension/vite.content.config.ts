import { defineConfig } from 'vite';
import { resolve } from 'path';

// Content Script build config (IIFE for isolated scope)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content-script/transcript.ts'),
      name: 'contentScript',
      formats: ['iife'],
      fileName: () => 'content-script.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content-script.js',
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
