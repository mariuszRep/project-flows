#!/usr/bin/env node

/**
 * PostgreSQL Database Backup Script
 * 
 * This script creates a backup of the PostgreSQL database using Node.js pg library.
 * It exports tables schema and data to JSON files.
 * 
 * Usage:
 *   node backup.js [options]
 * 
 * Options:
 *   --output-dir=<path>   Directory to store backups (default: ./backups)
 *   --tables=<list>       Comma-separated list of tables to backup (default: all)
 *   --schema-only         Only backup schema, not data
 *   --data-only           Only backup data, not schema
 *   --verbose             Show detailed progress information
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import pg from 'pg';
import { pipeline } from 'stream/promises';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  outputDir: './backups',
  tables: [],
  schemaOnly: false,
  dataOnly: false,
  verbose: false
};

// Parse command line arguments
args.forEach(arg => {
  if (arg.startsWith('--output-dir=')) {
    options.outputDir = arg.split('=')[1];
  } else if (arg.startsWith('--tables=')) {
    options.tables = arg.split('=')[1].split(',');
  } else if (arg === '--schema-only') {
    options.schemaOnly = true;
  } else if (arg === '--data-only') {
    options.dataOnly = true;
  } else if (arg === '--verbose') {
    options.verbose = true;
  }
});

// Get database connection info from environment variables
const getDbConfig = async () => {
  // Try to load from .env file if it exists
  try {
    const { default: dotenv } = await import('dotenv');
    dotenv.config({ path: join(__dirname, '../..', '.env') });
  } catch (err) {
    console.log('dotenv not available, using environment variables directly');
  }

  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.POSTGRES_USER || 'mcp_user'}:${process.env.POSTGRES_PASSWORD || 'mcp_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'mcp_tasks'}`;
  
  // Parse connection string to get components
  let dbConfig = {};
  
  try {
    const url = new URL(connectionString);
    dbConfig = {
      host: url.hostname,
      port: url.port,
      database: url.pathname.substring(1),
      user: url.username,
      password: url.password
    };
  } catch (err) {
    console.error('Error parsing connection string:', err);
    process.exit(1);
  }
  
  return dbConfig;
};

/**
 * Get list of all tables in the database
 */
async function getAllTables(pool) {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  const result = await pool.query(query);
  return result.rows.map(row => row.table_name);
}

/**
 * Get database functions
 */
async function getDatabaseFunctions(pool) {
  const query = `
    SELECT 
      routine_name,
      routine_definition,
      routine_type,
      data_type,
      routine_schema
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    ORDER BY routine_name;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get database triggers
 */
async function getDatabaseTriggers(pool) {
  const query = `
    SELECT 
      trigger_name,
      event_manipulation,
      event_object_table,
      action_statement,
      action_timing,
      action_condition
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get foreign key constraints
 */
async function getForeignKeyConstraints(pool) {
  const query = `
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get table schema information
 */
async function getTableSchema(pool, tableName) {
  // Get column information
  const columnsQuery = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `;
  
  // Get primary key information
  const pkQuery = `
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary;
  `;
  
  // Get foreign key information
  const fkQuery = `
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = $1;
  `;
  
  // Get index information
  const indexQuery = `
    SELECT
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique
    FROM
      pg_class t,
      pg_class i,
      pg_index ix,
      pg_attribute a
    WHERE
      t.oid = ix.indrelid
      AND i.oid = ix.indexrelid
      AND a.attrelid = t.oid
      AND a.attnum = ANY(ix.indkey)
      AND t.relkind = 'r'
      AND t.relname = $1
    ORDER BY
      i.relname, a.attnum;
  `;
  
  // Execute all queries in parallel
  const [columns, primaryKeys, foreignKeys, indexes] = await Promise.all([
    pool.query(columnsQuery, [tableName]),
    pool.query(pkQuery, [tableName]),
    pool.query(fkQuery, [tableName]),
    pool.query(indexQuery, [tableName])
  ]);
  
  // Get create table statement
  const createTableQuery = `
    SELECT pg_get_tabledef('${tableName}') AS create_statement;
  `;
  
  let createTableStatement = null;
  try {
    const createResult = await pool.query(createTableQuery);
    createTableStatement = createResult.rows[0]?.create_statement;
  } catch (error) {
    console.log(`Could not get CREATE TABLE statement for ${tableName}, using schema information instead`);
  }
  
  return {
    name: tableName,
    columns: columns.rows,
    primaryKeys: primaryKeys.rows.map(row => row.attname),
    foreignKeys: foreignKeys.rows,
    indexes: indexes.rows,
    createStatement: createTableStatement
  };
}

/**
 * Get table data
 */
async function getTableData(pool, tableName, batchSize = 1000) {
  // Get total count
  const countQuery = `SELECT COUNT(*) FROM "${tableName}";`;
  const countResult = await pool.query(countQuery);
  const totalCount = parseInt(countResult.rows[0].count);
  
  if (options.verbose) {
    console.log(`Table ${tableName} has ${totalCount} rows`);
  }
  
  if (totalCount === 0) {
    return [];
  }
  
  // For small tables, get all data at once
  if (totalCount <= batchSize) {
    const query = `SELECT * FROM "${tableName}";`;
    const result = await pool.query(query);
    return result.rows;
  }
  
  // For larger tables, use batching
  const data = [];
  let offset = 0;
  
  while (offset < totalCount) {
    if (options.verbose) {
      console.log(`Fetching rows ${offset} to ${offset + batchSize} from ${tableName}`);
    }
    
    const query = `SELECT * FROM "${tableName}" LIMIT ${batchSize} OFFSET ${offset};`;
    const result = await pool.query(query);
    data.push(...result.rows);
    offset += batchSize;
  }
  
  return data;
}

/**
 * Create a backup of the PostgreSQL database
 */
async function backupDatabase() {
  try {
    const dbConfig = await getDbConfig();
    const pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    // Create backup directory if it doesn't exist
    const backupDir = join(__dirname, options.outputDir);
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${dbConfig.database}_backup_${timestamp}`;
    const backupFilePath = join(backupDir, `${backupFileName}.json.gz`);
    
    console.log(`Starting database backup of ${dbConfig.database}...`);
    
    // Get list of tables
    let tables = options.tables;
    if (tables.length === 0) {
      tables = await getAllTables(pool);
    }
    
    if (options.verbose) {
      console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);
    }
    
    // Get database objects
    console.log('Collecting database functions, triggers, and constraints...');
    const [functions, triggers, foreignKeys] = await Promise.all([
      getDatabaseFunctions(pool),
      getDatabaseTriggers(pool),
      getForeignKeyConstraints(pool)
    ]);

    if (options.verbose) {
      console.log(`Found ${functions.length} functions, ${triggers.length} triggers, ${foreignKeys.length} foreign keys`);
    }

    // Backup object to store all data
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        database: dbConfig.database,
        tables: tables,
        schemaOnly: options.schemaOnly,
        dataOnly: options.dataOnly,
        functionsCount: functions.length,
        triggersCount: triggers.length,
        foreignKeysCount: foreignKeys.length
      },
      schemas: {},
      data: {},
      functions: functions,
      triggers: triggers,
      foreignKeys: foreignKeys
    };
    
    // Process each table
    for (const tableName of tables) {
      if (options.verbose) {
        console.log(`Processing table: ${tableName}`);
      }
      
      // Get schema information if not data-only
      if (!options.dataOnly) {
        backup.schemas[tableName] = await getTableSchema(pool, tableName);
      }
      
      // Get data if not schema-only
      if (!options.schemaOnly) {
        backup.data[tableName] = await getTableData(pool, tableName);
      }
    }
    
    // Write backup to compressed file
    const gzip = createGzip();
    const output = createWriteStream(backupFilePath);
    
    const jsonString = JSON.stringify(backup);
    const { Readable } = await import('stream');
    const inputStream = Readable.from([jsonString]);
    
    await pipeline(inputStream, gzip, output);
    
    console.log(`Backup completed successfully: ${backupFilePath}`);
    
    // Create metadata file with backup information
    const metadata = {
      timestamp: new Date().toISOString(),
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      tables: tables,
      schemaOnly: options.schemaOnly,
      dataOnly: options.dataOnly,
      filename: backupFilePath,
      compressed: true
    };
    
    const metadataPath = join(backupDir, `${backupFileName}.meta.json`);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`Backup metadata saved: ${metadataPath}`);
    
    await pool.end();
    return backupFilePath;
    
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

/**
 * Test database connection before backup
 */
async function testConnection() {
  const dbConfig = await getDbConfig();
  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password
  });
  
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Test connection first
    const connectionSuccessful = await testConnection();
    
    if (!connectionSuccessful) {
      console.error('Aborting backup due to connection failure');
      process.exit(1);
    }
    
    // Perform backup
    await backupDatabase();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Add function to get table definition
async function setupPgGetTableDef(pool) {
  const functionExists = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'pg_get_tabledef'
    ) as exists;
  `);
  
  if (!functionExists.rows[0].exists) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION pg_get_tabledef(p_table_name varchar) 
      RETURNS text AS $$
      DECLARE
        v_table_ddl text;
        column_record record;
        constraint_record record;
        index_record record;
      BEGIN
        v_table_ddl := 'CREATE TABLE ' || p_table_name || ' (' || chr(10);
        
        FOR column_record IN 
          SELECT 
            column_name, 
            data_type, 
            coalesce(character_maximum_length, numeric_precision) as max_length, 
            is_nullable, 
            column_default
          FROM information_schema.columns
          WHERE table_name = p_table_name
          ORDER BY ordinal_position
        LOOP
          v_table_ddl := v_table_ddl || '  ' || column_record.column_name || ' ' || column_record.data_type;
          
          IF column_record.max_length IS NOT NULL THEN
            v_table_ddl := v_table_ddl || '(' || column_record.max_length || ')';
          END IF;
          
          IF column_record.is_nullable = 'NO' THEN
            v_table_ddl := v_table_ddl || ' NOT NULL';
          END IF;
          
          IF column_record.column_default IS NOT NULL THEN
            v_table_ddl := v_table_ddl || ' DEFAULT ' || column_record.column_default;
          END IF;
          
          v_table_ddl := v_table_ddl || ',' || chr(10);
        END LOOP;
        
        -- Remove the last comma
        v_table_ddl := substring(v_table_ddl, 1, length(v_table_ddl) - 2) || chr(10) || ')';
        
        RETURN v_table_ddl;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupDatabase, testConnection };

