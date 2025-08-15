import { Client } from 'pg'
import { migrate } from 'pg-node-migrations'
import fs from 'node:fs'
import type { Logger } from '../types'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SCHEMA = 'mux'

// Helper function to get __dirname that works in both ESM and CommonJS
function getDirname(): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const __filename = fileURLToPath(import.meta.url)
      return path.dirname(__filename)
    }
  } catch (error) {
    // Fallback for cases where import.meta.url is not available
  }
  
  // Fallback for CommonJS context
  try {
    // @ts-ignore - __dirname is available in CommonJS context
    return __dirname
  } catch (error) {
    // If neither works, use a relative path from the current working directory
    return path.join(process.cwd(), 'packages/sync-engine/src/database')
  }
}

type MigrationConfig = {
  databaseUrl: string
  logger?: Logger
}

async function connectAndMigrate(
  client: Client,
  migrationsDirectory: string,
  logger: Logger,
  logOnError = false
) {
  if (!fs.existsSync(migrationsDirectory)) {
    logger.info(`Migrations directory ${migrationsDirectory} not found, skipping`)
    return
  }

  const optionalConfig = {
    schemaName: DEFAULT_SCHEMA,
    tableName: 'migrations',
  }

  try {
    await migrate({ client }, migrationsDirectory, optionalConfig)
  } catch (error) {
    if (logOnError && error instanceof Error) {
      logger.error(error, 'Migration error:')
    } else {
      throw error
    }
  }
}

export async function runMigrations(config: MigrationConfig): Promise<void> {
  // Init DB
  const client = new Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 10_000,
  })

  const logger: Logger = config.logger || console

  try {
    // Run migrations
    await client.connect()

    // Ensure schema exists, not doing it via migration to not break current migration checksums
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${DEFAULT_SCHEMA};`)

    logger.info('Running migrations')

    await connectAndMigrate(client, path.resolve(getDirname(), './migrations'), logger)
  } catch (err) {
    logger.error(err as Error, 'Error running migrations')
  } finally {
    await client.end()
    logger.info('Finished migrations')
  }
}
