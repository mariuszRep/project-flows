#!/usr/bin/env node

/**
 * Bootstrap script to load schema_properties.json into database
 * Uses UPSERT to avoid duplicates on restart
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

async function loadSchemaProperties() {
  try {
    console.log('Loading schema properties into database...');
    
    // Read schema_properties.json (mounted as volume)
    const schemaPath = join(__dirname, 'schema_properties.json');
    const schemaData = readFileSync(schemaPath, 'utf8');
    const properties = JSON.parse(schemaData);
    
    // Insert or update each property
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [key, value] of Object.entries(properties)) {
        const query = `
          INSERT INTO schema_properties (key, value) 
          VALUES ($1, $2) 
          ON CONFLICT (key) 
          DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
        `;
        
        await client.query(query, [key, JSON.stringify(value)]);
        console.log(`Loaded property: ${key}`);
      }
      
      await client.query('COMMIT');
      console.log('Schema properties loaded successfully!');
      
      // Verify the data
      const result = await client.query('SELECT key, value FROM schema_properties ORDER BY key');
      console.log(`Loaded ${result.rows.length} schema properties:`, result.rows.map(r => r.key));
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadSchemaProperties();
}