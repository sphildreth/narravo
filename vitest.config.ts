import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Use node for server-side tests, jsdom only where needed
    environment: 'node',

    // Keep per-file isolation so garbage can be collected between files
    isolate: true,

    // Constrain parallelism

    // Turn off coverage by default (run it separately)
    coverage: { enabled: false },

    // Lower concurrency inside a single file's \`test.concurrent\`
    maxConcurrency: 4,

    // Don't transform huge folders
    exclude: ['dist', 'build', '.next', 'coverage', 'node_modules', 'tests/e2e/**']
  }
})
