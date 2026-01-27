import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@fortune-sheet/react': path.resolve(__dirname, 'packages/react/src'),
      '@fortune-sheet/core': path.resolve(__dirname, 'packages/core/src'),
    },
  },
  publicDir: 'public',
});

