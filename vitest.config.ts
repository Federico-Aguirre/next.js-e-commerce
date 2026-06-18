import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    /* 🎯 CLAVE: Vitest solo va a buscar archivos .test.tsx dentro de src */
    include: ['src/**/*.test.tsx'], 
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});