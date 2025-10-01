// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = [
  // Make sure the more specific drizzle alias matches before '@'
  { find: '@/drizzle', replacement: fileURLToPath(new URL('./drizzle/', import.meta.url)) },
  { find: '@/scripts', replacement: fileURLToPath(new URL('./scripts/', import.meta.url)) },
  { find: '@', replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
];

export default defineConfig({
  resolve: {
    alias: [
      // Make sure the more specific drizzle alias matches before '@'
      { find: '@/drizzle', replacement: fileURLToPath(new URL('./drizzle/', import.meta.url)) },
      { find: '@/scripts', replacement: fileURLToPath(new URL('./scripts/', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: [
      'tests/e2e/**', // Playwright e2e tests run separately
      'node_modules/**', // Exclude node_modules
    ],
    environmentMatchGlobs: [
      ['tests/**/*.test.tsx', 'jsdom'],
    ],
  },
});