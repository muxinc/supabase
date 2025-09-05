import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60 seconds for database operations
    hookTimeout: 60000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    // Silence PostgreSQL connection termination warnings during cleanup
    silent: process.env.CI === 'true' ? true : false,
    // Handle unhandled rejections more gracefully
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
