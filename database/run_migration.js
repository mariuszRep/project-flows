#!/usr/bin/env node

/**
 * Database migration runner for schema notification triggers
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read migration file
    const migrationFile = join(__dirname, 'migrations', '001_add_schema_notification_triggers.sql');
    const migrationSQL = readFileSync(migrationFile, 'utf8');

    // Execute migration
    console.log('Running schema notification triggers migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully');

    // Test the trigger by checking if it exists
    const result = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_name IN ('properties_notify_change', 'templates_notify_change')
      ORDER BY trigger_name
    `);

    console.log('Installed triggers:');
    result.rows.forEach(row => {
      console.log(`- ${row.trigger_name} on ${row.event_object_table} (${row.event_manipulation})`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}

export { runMigration };