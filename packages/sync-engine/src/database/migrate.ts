import { Client } from 'pg';
import { migrate } from 'pg-node-migrations';
import fs from 'node:fs';
import type { Logger } from '../types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SCHEMA = 'mux';

function getMigrationsPath(): string {
  try {
    const packageJsonPath = require.resolve('@mux/sync-engine/package.json');
    const packageDir = path.dirname(packageJsonPath);

    // Check if migrations exist in dist/migrations (compiled package)
    const distMigrationsPath = path.join(packageDir, 'dist', 'migrations');
    if (fs.existsSync(distMigrationsPath)) {
      return distMigrationsPath;
    }

    // Check if migrations exist in src/database/migrations (source)
    const srcMigrationsPath = path.join(
      packageDir,
      'src',
      'database',
      'migrations'
    );
    if (fs.existsSync(srcMigrationsPath)) {
      return srcMigrationsPath;
    }

    // Fallback: try to use __dirname approach
    let baseDir: string;
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const __filename = fileURLToPath(import.meta.url);
      baseDir = path.dirname(__filename);
    } else {
      // @ts-ignore - __dirname is available in CommonJS context
      baseDir = __dirname;
    }

    // Try migrations relative to current file
    const relativeMigrationsPath = path.resolve(baseDir, 'migrations');
    if (fs.existsSync(relativeMigrationsPath)) {
      return relativeMigrationsPath;
    }

    throw new Error('Could not find migrations directory');
  } catch (error) {
    throw new Error(
      `Failed to locate migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

type MigrationConfig = {
  databaseUrl: string;
  logger?: Logger;
};

async function connectAndMigrate(
  client: Client,
  migrationsDirectory: string,
  logger: Logger,
  logOnError = false
) {
  if (!fs.existsSync(migrationsDirectory)) {
    logger.info(
      `Migrations directory ${migrationsDirectory} not found, skipping`
    );
    return;
  }

  const optionalConfig = {
    schemaName: DEFAULT_SCHEMA,
    tableName: 'migrations',
  };

  try {
    await migrate({ client }, migrationsDirectory, optionalConfig);
  } catch (error) {
    if (logOnError && error instanceof Error) {
      logger.error(error, 'Migration error:');
    } else {
      throw error;
    }
  }
}

export async function runMigrations(config: MigrationConfig): Promise<void> {
  // Init DB
  const client = new Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 10_000,
  });

  const logger: Logger = config.logger || console;

  try {
    // Run migrations
    await client.connect();

    // Ensure schema exists, not doing it via migration to not break current migration checksums
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${DEFAULT_SCHEMA};`);

    logger.info('Running migrations');

    // Find the migrations directory
    const migrationsPath = getMigrationsPath();
    logger.info(`Looking for migrations in: ${migrationsPath}`);

    await connectAndMigrate(client, migrationsPath, logger);
  } catch (err) {
    logger.error(err as Error, 'Error running migrations');
  } finally {
    await client.end();
    logger.info('Finished migrations');
  }
}
