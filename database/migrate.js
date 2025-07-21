#!/usr/bin/env node

/**
 * Database migration script
 * Ensures database tables are created and up to date
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
});

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    
    console.log('Database migrations completed successfully!');
    
    // Test the connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection test:', result.rows[0]);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}