#!/usr/bin/env node

/**
 * PostgreSQL Database JSON Restore Script
 * 
 * This script restores a database from a JSON backup file created by backup.js.
 * 
 * Usage:
 *   node restore-json.js <backup-file> [--database=new_db_name] [--verbose]
 * 
 * Options:
 *   --database=<name>    Target database name (will be created if doesn't exist)
 *   --verbose            Show detailed progress information
 */

import { readFile, createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import pg from 'pg';

const { Pool, Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args[0];

if (!backupFile) {
  console.error('Error: Backup file path is required');
  console.log('Usage: node restore-json.js <backup-file> [--database=new_db_name] [--verbose]');
  process.exit(1);
}

const options = {
  targetDatabase: null,
  verbose: false
};

// Parse command line arguments
args.slice(1).forEach(arg => {
  if (arg.startsWith('--database=')) {
    options.targetDatabase = arg.split('=')[1];
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
      database: options.targetDatabase || url.pathname.substring(1),
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
 * Create database if it doesn't exist
 */
async function createDatabaseIfNotExists(dbConfig) {
  // Connect to postgres database to create the target database
  const adminConfig = { ...dbConfig, database: 'postgres' };
  const adminClient = new Client(adminConfig);
  
  try {
    await adminClient.connect();
    
    // Check if database exists
    const checkQuery = 'SELECT 1 FROM pg_database WHERE datname = $1';
    const result = await adminClient.query(checkQuery, [dbConfig.database]);
    
    if (result.rows.length === 0) {
      console.log(`Creating database: ${dbConfig.database}`);
      await adminClient.query(`CREATE DATABASE "${dbConfig.database}"`);
      console.log(`Database ${dbConfig.database} created successfully`);
    } else {
      console.log(`Database ${dbConfig.database} already exists`);
    }
    
  } finally {
    await adminClient.end();
  }
}

/**
 * Read and decompress backup file
 */
async function readBackupFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }
  
  let data = '';
  
  if (filePath.endsWith('.gz')) {
    // Decompress gzipped file
    const gunzip = createGunzip();
    const input = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      input.pipe(gunzip)
        .on('data', chunk => chunks.push(chunk))
        .on('end', () => {
          const jsonString = Buffer.concat(chunks).toString();
          try {
            resolve(JSON.parse(jsonString));
          } catch (err) {
            reject(new Error(`Failed to parse JSON: ${err.message}`));
          }
        })
        .on('error', reject);
    });
  } else {
    // Read plain JSON file
    const jsonString = await readFile(filePath, 'utf8');
    return JSON.parse(jsonString);
  }
}

/**
 * Create enum types
 */
async function createEnumTypes(pool) {
  // Create task_stage enum
  try {
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE task_stage AS ENUM ('draft', 'backlog', 'doing', 'review', 'completed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  } catch (error) {
    if (options.verbose) {
      console.warn(`Warning: Could not create task_stage enum: ${error.message}`);
    }
  }
}

/**
 * Create database functions
 */
async function createFunctions(pool, functions) {
  for (const func of functions) {
    if (options.verbose) {
      console.log(`Creating function: ${func.routine_name}`);
    }
    
    try {
      // Create the function
      const functionSQL = `
        CREATE OR REPLACE FUNCTION ${func.routine_name}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        ${func.routine_definition}
        $$;
      `;
      
      await pool.query(functionSQL);
    } catch (error) {
      console.warn(`Warning: Could not create function ${func.routine_name}: ${error.message}`);
    }
  }
}

/**
 * Create foreign key constraints
 */
async function createForeignKeys(pool, foreignKeys) {
  for (const fk of foreignKeys) {
    if (options.verbose) {
      console.log(`Creating foreign key: ${fk.constraint_name} on ${fk.table_name}`);
    }
    
    try {
      let constraintSQL = `
        ALTER TABLE "${fk.table_name}" 
        ADD CONSTRAINT "${fk.constraint_name}" 
        FOREIGN KEY ("${fk.column_name}") 
        REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}")
      `;
      
      if (fk.update_rule && fk.update_rule !== 'NO ACTION') {
        constraintSQL += ` ON UPDATE ${fk.update_rule}`;
      }
      
      if (fk.delete_rule && fk.delete_rule !== 'NO ACTION') {
        constraintSQL += ` ON DELETE ${fk.delete_rule}`;
      }
      
      await pool.query(constraintSQL);
    } catch (error) {
      console.warn(`Warning: Could not create foreign key ${fk.constraint_name}: ${error.message}`);
    }
  }
}

/**
 * Create triggers
 */
async function createTriggers(pool, triggers) {
  for (const trigger of triggers) {
    if (options.verbose) {
      console.log(`Creating trigger: ${trigger.trigger_name} on ${trigger.event_object_table}`);
    }
    
    try {
      const triggerSQL = `
        CREATE TRIGGER "${trigger.trigger_name}"
        ${trigger.action_timing} ${trigger.event_manipulation}
        ON "${trigger.event_object_table}"
        FOR EACH ROW
        ${trigger.action_statement};
      `;
      
      await pool.query(triggerSQL);
    } catch (error) {
      console.warn(`Warning: Could not create trigger ${trigger.trigger_name}: ${error.message}`);
    }
  }
}

/**
 * Create sequences for serial columns
 */
async function createSequences(pool, tableName, columns) {
  for (const col of columns) {
    if (col.column_default && col.column_default.includes('nextval')) {
      // Extract sequence name from default value
      const seqMatch = col.column_default.match(/nextval\('([^']+)'/);
      if (seqMatch) {
        const sequenceName = seqMatch[1];
        if (options.verbose) {
          console.log(`Creating sequence: ${sequenceName}`);
        }
        
        try {
          await pool.query(`CREATE SEQUENCE IF NOT EXISTS "${sequenceName}" AS integer START WITH 1 INCREMENT BY 1`);
        } catch (error) {
          if (options.verbose) {
            console.warn(`Warning: Could not create sequence ${sequenceName}: ${error.message}`);
          }
        }
      }
    }
  }
}

/**
 * Create table from schema information
 */
async function createTable(pool, schema) {
  const { name, columns, primaryKeys, foreignKeys, indexes } = schema;
  
  if (options.verbose) {
    console.log(`Creating table: ${name}`);
  }
  
  // Create sequences first
  await createSequences(pool, name, columns);
  
  // Build CREATE TABLE statement
  let createSQL = `CREATE TABLE IF NOT EXISTS "${name}" (\n`;
  
  const columnDefs = columns.map(col => {
    let dataType = col.data_type;
    
    // Handle PostgreSQL array types
    if (dataType === 'ARRAY') {
      dataType = 'text[]'; // Default to text array
    }
    
    // Handle user-defined types (enums) - extract from default value
    if (dataType === 'USER-DEFINED' && col.column_default) {
      const enumMatch = col.column_default.match(/::([\w_]+)/);
      if (enumMatch) {
        dataType = enumMatch[1]; // Use the enum type name
      } else {
        dataType = 'text'; // Fallback to text
      }
    }
    
    let def = `  "${col.column_name}" ${dataType}`;
    
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }
    
    return def;
  });
  
  createSQL += columnDefs.join(',\n');
  
  // Add primary key constraint
  if (primaryKeys.length > 0) {
    const pkColumns = primaryKeys.map(pk => `"${pk}"`).join(', ');
    createSQL += `,\n  PRIMARY KEY (${pkColumns})`;
  }
  
  createSQL += '\n);';
  
  if (options.verbose) {
    console.log(`SQL for ${name}:\n${createSQL}`);
  }
  
  await pool.query(createSQL);
  
  // Create indexes (skip primary key indexes)
  const uniqueIndexes = new Map();
  indexes.forEach(idx => {
    if (!primaryKeys.includes(idx.column_name)) {
      if (!uniqueIndexes.has(idx.index_name)) {
        uniqueIndexes.set(idx.index_name, {
          name: idx.index_name,
          unique: idx.is_unique,
          columns: []
        });
      }
      uniqueIndexes.get(idx.index_name).columns.push(idx.column_name);
    }
  });
  
  for (const [indexName, indexInfo] of uniqueIndexes) {
    const uniqueClause = indexInfo.unique ? 'UNIQUE ' : '';
    const columns = indexInfo.columns.map(col => `"${col}"`).join(', ');
    const indexSQL = `CREATE ${uniqueClause}INDEX IF NOT EXISTS "${indexName}" ON "${name}" (${columns});`;
    
    try {
      await pool.query(indexSQL);
    } catch (error) {
      if (options.verbose) {
        console.warn(`Warning: Could not create index ${indexName}: ${error.message}`);
      }
    }
  }
}

/**
 * Insert data into table
 */
async function insertData(pool, tableName, data) {
  if (!data || data.length === 0) {
    return;
  }
  
  if (options.verbose) {
    console.log(`Inserting ${data.length} rows into ${tableName}`);
  }
  
  // Get column names from first row
  const columns = Object.keys(data[0]);
  const columnList = columns.map(col => `"${col}"`).join(', ');
  
  // Batch insert for better performance
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const values = [];
    const placeholders = [];
    
    batch.forEach((row, rowIndex) => {
      const rowPlaceholders = [];
      columns.forEach((col, colIndex) => {
        values.push(row[col]);
        rowPlaceholders.push(`$${values.length}`);
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });
    
    const insertSQL = `INSERT INTO "${tableName}" (${columnList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`;
    
    try {
      await pool.query(insertSQL, values);
    } catch (error) {
      console.error(`Error inserting batch into ${tableName}:`, error.message);
      throw error;
    }
  }
}

/**
 * Update sequence values after data insertion
 */
async function updateSequences(pool, tableName, columns, data) {
  if (!data || data.length === 0) return;
  
  for (const col of columns) {
    if (col.column_default && col.column_default.includes('nextval')) {
      const seqMatch = col.column_default.match(/nextval\('([^']+)'/);
      if (seqMatch) {
        const sequenceName = seqMatch[1];
        const columnName = col.column_name;
        
        // Find max value in the data
        const maxValue = Math.max(...data.map(row => row[columnName] || 0));
        
        if (maxValue > 0) {
          if (options.verbose) {
            console.log(`Updating sequence ${sequenceName} to ${maxValue + 1}`);
          }
          
          try {
            await pool.query(`SELECT setval('${sequenceName}', $1, true)`, [maxValue]);
          } catch (error) {
            if (options.verbose) {
              console.warn(`Warning: Could not update sequence ${sequenceName}: ${error.message}`);
            }
          }
        }
      }
    }
  }
}

/**
 * Restore database from JSON backup
 */
async function restoreFromJson(backupFilePath) {
  try {
    const dbConfig = await getDbConfig();
    
    console.log(`Starting JSON restore to database: ${dbConfig.database}`);
    
    // Create database if it doesn't exist
    if (options.targetDatabase) {
      await createDatabaseIfNotExists(dbConfig);
    }
    
    // Read backup file
    console.log('Reading backup file...');
    const backup = await readBackupFile(backupFilePath);
    
    if (options.verbose) {
      console.log(`Backup metadata:`, backup.metadata);
    }
    
    // Connect to target database
    const pool = new Pool(dbConfig);
    
    try {
      // Test connection
      await pool.query('SELECT NOW()');
      console.log(`Connected to database: ${dbConfig.database}`);
      
      // Create enum types first
      await createEnumTypes(pool);
      
      // Create functions before tables (triggers depend on them)
      if (backup.functions && backup.functions.length > 0) {
        console.log(`Creating ${backup.functions.length} database functions...`);
        await createFunctions(pool, backup.functions);
      }
      
      // Process each table
      const tables = backup.metadata.tables;
      
      for (const tableName of tables) {
        console.log(`Processing table: ${tableName}`);
        
        // Create table schema if available
        if (backup.schemas && backup.schemas[tableName]) {
          await createTable(pool, backup.schemas[tableName]);
        }
        
        // Insert data if available
        if (backup.data && backup.data[tableName]) {
          await insertData(pool, tableName, backup.data[tableName]);
          
          // Update sequences after inserting data
          if (backup.schemas && backup.schemas[tableName]) {
            await updateSequences(pool, tableName, backup.schemas[tableName].columns, backup.data[tableName]);
          }
        }
      }
      
      // Create foreign key constraints after all tables are created
      if (backup.foreignKeys && backup.foreignKeys.length > 0) {
        console.log(`Creating ${backup.foreignKeys.length} foreign key constraints...`);
        await createForeignKeys(pool, backup.foreignKeys);
      }
      
      // Create triggers last (after tables and functions exist)
      if (backup.triggers && backup.triggers.length > 0) {
        console.log(`Creating ${backup.triggers.length} triggers...`);
        await createTriggers(pool, backup.triggers);
      }
      
      console.log('Restore completed successfully!');
      
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await restoreFromJson(backupFile);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { restoreFromJson };