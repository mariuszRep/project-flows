#!/usr/bin/env node

/**
 * PostgreSQL Database Restore Script
 * 
 * This script restores a database from a backup file created by the backup.js script.
 * 
 * Usage:
 *   node restore.js <backup-file> [options]
 * 
 * Options:
 *   --clean              Clean (drop) database objects before recreating
 *   --create             Create the database before restoring
 *   --no-owner           Skip restoration of object ownership
 *   --verbose            Show detailed progress information
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args[0];

if (!backupFile) {
  console.error('Error: Backup file path is required');
  console.log('Usage: node restore.js <backup-file> [options]');
  process.exit(1);
}

const options = {
  clean: false,
  create: false,
  noOwner: false,
  verbose: false
};

// Parse command line arguments
args.slice(1).forEach(arg => {
  if (arg === '--clean') {
    options.clean = true;
  } else if (arg === '--create') {
    options.create = true;
  } else if (arg === '--no-owner') {
    options.noOwner = true;
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
 * Restore a database from a backup file
 */
async function restoreDatabase(backupFilePath) {
  try {
    if (!existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }
    
    const dbConfig = await getDbConfig();
    
    console.log(`Starting database restore to ${dbConfig.database} from ${backupFilePath}...`);
    
    // Determine restore command based on file extension
    let restoreCmd = 'pg_restore';
    let isPlainSql = backupFilePath.endsWith('.sql');
    
    if (isPlainSql) {
      restoreCmd = 'psql';
    }
    
    // Build restore command arguments
    const restoreArgs = [
      `-h`, dbConfig.host,
      `-p`, dbConfig.port,
      `-U`, dbConfig.user,
    ];
    
    if (isPlainSql) {
      // psql arguments
      restoreArgs.push(
        `-d`, dbConfig.database,
        `-f`, backupFilePath
      );
    } else {
      // pg_restore arguments
      restoreArgs.push(
        `-d`, dbConfig.database,
        `-F`, 'c', // Assume custom format for .dump files
      );
      
      if (options.clean) {
        restoreArgs.push('--clean');
      }
      
      if (options.create) {
        restoreArgs.push('--create');
      }
      
      if (options.noOwner) {
        restoreArgs.push('--no-owner');
      }
      
      restoreArgs.push(backupFilePath);
    }
    
    // Add verbose option if specified
    if (options.verbose) {
      restoreArgs.push('-v');
    }
    
    // Set environment variable for password
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    
    // Execute restore command
    const restore = spawn(restoreCmd, restoreArgs, { env });
    
    restore.stdout.on('data', (data) => {
      if (options.verbose) {
        console.log(data.toString());
      }
    });
    
    restore.stderr.on('data', (data) => {
      console.error(`${restoreCmd} stderr: ${data}`);
    });
    
    return new Promise((resolve, reject) => {
      restore.on('close', (code) => {
        if (code === 0) {
          console.log(`Restore completed successfully to database: ${dbConfig.database}`);
          resolve(true);
        } else {
          reject(new Error(`${restoreCmd} process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  }
}

/**
 * Test database connection before restore
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
      console.error('Aborting restore due to connection failure');
      process.exit(1);
    }
    
    // Perform restore
    await restoreDatabase(backupFile);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { restoreDatabase, testConnection };
