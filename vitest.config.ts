import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Use node for server-side tests, jsdom only where needed
    environment: 'node',

    // Keep per-file isolation so garbage can be collected between files
    isolate: true,

    // Constrain parallelism
    pool: 'threads', // try 'forks' if you suspect a memory leak crossing worker boundaries
    poolOptions: {
      threads: { maxThreads: 4, minThreads: 1 },
      // forks: { singleFork: false } // alternative if you switch pools
    },

    // Turn off coverage by default (run it separately)
    coverage: { enabled: false },

    // Lower concurrency inside a single file's \`test.concurrent\`
    maxConcurrency: 4,

    // Don't transform huge folders
    exclude: ['dist', 'build', '.next', 'coverage', 'node_modules', 'tests/e2e/**']
  }
})
