#!/usr/bin/env node

/**
 * Database Backup Trigger
 * 
 * A simple script to trigger database backups with default settings.
 * This can be used as an entry point for cron jobs or other schedulers.
 */

import { backupDatabase } from './backup.js';

// Run backup with default settings
backupDatabase()
  .then(backupPath => {
    console.log(`Backup completed: ${backupPath}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
  });
