import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { securityHeaders } from './build/security-headers.ts';
import { serviceWorker } from './build/service-worker.ts';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), securityHeaders(), serviceWorker()],
  resolve: {
    alias: {
      '@': path.resolve(srcDir),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Screen tests render whole pages (Home has a ~370-cell heatmap); allow for busy CI machines.
    testTimeout: 15_000,
    include: [
      'src/**/*.test.{ts,tsx}',
      'netlify/**/*.test.ts',
      'build/**/*.test.ts',
      'supabase/**/*.test.ts',
    ],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/core/logic/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
