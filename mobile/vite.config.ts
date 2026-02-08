import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
