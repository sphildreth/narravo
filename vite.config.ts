// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

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
  },
});
