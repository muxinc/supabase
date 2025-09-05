import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from 'pg';
import { runMigrations } from '../database/migrate';
import { getTestDatabaseUrl } from './setup';

describe('runMigrations', () => {
  let client: Client;
  let databaseUrl: string;

  beforeEach(async () => {
    databaseUrl = getTestDatabaseUrl();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // Clean up any existing mux schema
    await client.query('DROP SCHEMA IF EXISTS mux CASCADE');
  });

  afterEach(async () => {
    await client.end();
  });

  it('should create mux schema', async () => {
    await runMigrations({ databaseUrl });

    // Check if mux schema exists
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'mux'
    `);

    expect(schemaResult.rows).toHaveLength(1);
    expect(schemaResult.rows[0].schema_name).toBe('mux');
  });

  it('should create migrations table', async () => {
    await runMigrations({ databaseUrl });

    // Check if migrations table exists
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'mux' AND table_name = 'migrations'
    `);

    expect(tableResult.rows).toHaveLength(1);
    expect(tableResult.rows[0].table_name).toBe('migrations');
  });

  it('should create all mux tables', async () => {
    await runMigrations({ databaseUrl });

    // Check if all expected tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'mux'
      ORDER BY table_name
    `);

    const tableNames = tablesResult.rows.map((row) => row.table_name);

    // Expected tables based on migrations
    expect(tableNames).toContain('assets');
    expect(tableNames).toContain('live_streams');
    expect(tableNames).toContain('uploads');
    expect(tableNames).toContain('webhook_events');
    expect(tableNames).toContain('migrations');
  });

  it('should create proper table structure for assets', async () => {
    await runMigrations({ databaseUrl });

    // Check assets table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'mux' AND table_name = 'assets'
      ORDER BY column_name
    `);

    const columns = columnsResult.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          data_type: row.data_type,
          is_nullable: row.is_nullable,
        };
        return acc;
      },
      {} as Record<string, { data_type: string; is_nullable: string }>
    );

    // Check key columns exist
    expect(columns.id).toBeDefined();
    expect(columns.id.data_type).toBe('text');
    expect(columns.id.is_nullable).toBe('NO');

    expect(columns.status).toBeDefined();
    expect(columns.created_at).toBeDefined();
    expect(columns.duration_seconds).toBeDefined();
  });

  it('should handle running migrations multiple times without error', async () => {
    // Run migrations first time
    await runMigrations({ databaseUrl });

    // Run migrations second time - should not throw
    await expect(runMigrations({ databaseUrl })).resolves.toBeUndefined();

    // Verify tables still exist
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'mux'
    `);

    expect(parseInt(tablesResult.rows[0].table_count)).toBeGreaterThan(0);
  });

  it('should create proper indexes', async () => {
    await runMigrations({ databaseUrl });

    // Check if indexes exist (basic indexes from migration)
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'mux'
      ORDER BY indexname
    `);

    const indexNames = indexesResult.rows.map((row) => row.indexname);

    // Should have primary key indexes at minimum
    expect(indexNames.some((name) => name.includes('assets'))).toBe(true);
    expect(indexNames.some((name) => name.includes('live_streams'))).toBe(true);
  });
});
