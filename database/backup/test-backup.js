#!/usr/bin/env node

/**
 * Test script for database backup functionality
 * This script tests the backup process with minimal output
 */

import { backupDatabase, testConnection } from './backup.js';

async function runTest() {
  console.log('Testing database backup functionality...');
  
  // Test connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Database connection test failed');
    process.exit(1);
  }
  console.log('✅ Database connection test passed');
  
  // Run backup with test settings
  try {
    const backupPath = await backupDatabase();
    console.log(`✅ Backup test successful: ${backupPath}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Backup test failed:', err);
    process.exit(1);
  }
}

runTest();
