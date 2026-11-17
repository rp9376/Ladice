import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
  server: { port: 5173, strictPort: true },
  test: { include: ['tests/sim/**/*.test.ts'], environment: 'node', testTimeout: 120_000 },
});
