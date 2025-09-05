import { beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

// Global test database container
let postgresContainer: StartedTestContainer | null = null;

// This is expected when testcontainers stops the PostgreSQL container
// Silently ignore this error as it doesn't affect test functionality
process.on('unhandledRejection', (reason: any) => {
  if (
    reason?.message?.includes(
      'terminating connection due to administrator command'
    )
  ) {
    return;
  }
  // Re-throw other unhandled rejections
  throw reason;
});

process.on('uncaughtException', (error: any) => {
  if (
    error?.message?.includes(
      'terminating connection due to administrator command'
    )
  ) {
    return;
  }
  // Re-throw other uncaught exceptions
  throw error;
});

beforeAll(async () => {
  // Start PostgreSQL container for all tests
  postgresContainer = await new GenericContainer('postgres:15')
    .withEnvironment({
      POSTGRES_DB: 'test_mux_sync',
      POSTGRES_USER: 'test_user',
      POSTGRES_PASSWORD: 'test_password',
    })
    .withExposedPorts(5432)
    .start();

  // Make the database URL available to tests
  const host = postgresContainer.getHost();
  const port = postgresContainer.getMappedPort(5432);
  const databaseUrl = `postgresql://test_user:test_password@${host}:${port}/test_mux_sync`;
  process.env.TEST_DATABASE_URL = databaseUrl;

  console.log('✅ Test PostgreSQL container started:', databaseUrl);

  // Wait a bit for the database to be fully ready
  await new Promise<void>((resolve) => {
    global.setTimeout(resolve, 2000);
  });
}, 120000);

afterAll(async () => {
  if (postgresContainer) {
    // Give connections time to close gracefully before stopping container
    console.log('🔄 Waiting for connections to close...');
    await new Promise((resolve) => global.setTimeout(resolve, 1000));

    try {
      await postgresContainer.stop();
      console.log('✅ Test PostgreSQL container stopped');
    } catch {
      // Container might already be stopped, that's fine
      console.log('Container was already stopped or stopping');
    } finally {
      postgresContainer = null;
    }
  }
});

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Test database URL not available. Make sure setup.ts ran properly.'
    );
  }
  return url;
}
