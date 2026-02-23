/**
 * Job Scheduler
 * 
 * Runs scheduled jobs:
 * - Daily price update: 6:00 AM ET
 * - Position revaluation: 6:30 AM ET
 * - Cleanup old logs: 2:00 AM daily
 * 
 * Uses node-cron for scheduling.
 */

import cron from 'node-cron';
import dailyPriceUpdate from './jobs/daily-price-update.js';

console.log('[Scheduler] Starting job scheduler...');

// Daily Price Update: 6:00 AM ET (11:00 AM UTC)
cron.schedule('0 11 * * *', async () => {
  console.log('[Scheduler] Triggering daily price update...');
  try {
    await dailyPriceUpdate.runWithRetry();
  } catch (error) {
    console.error('[Scheduler] Daily price update failed:', error);
  }
}, {
  timezone: 'America/New_York'
});

console.log('[Scheduler] Jobs scheduled:');
console.log('  - Daily price update: 6:00 AM ET');
console.log('[Scheduler] Ready.');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n[Scheduler] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Scheduler] Shutting down...');
  process.exit(0);
});
