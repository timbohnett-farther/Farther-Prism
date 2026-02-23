/**
 * Daily Price Update Job
 * 
 * Runs every morning to re-price the entire security universe.
 * Implements the "growing list" pattern:
 * 1. Query all securities with last_seen_date set (ever used)
 * 2. Batch symbols into groups of 200
 * 3. Call FMP quote API for each batch
 * 4. Upsert prices into daily_prices table
 * 
 * Schedule: 6:00 AM ET (after market data is available)
 * Runtime: ~5 minutes for 10,000 securities (50 batches @ 6s each)
 */

import { query } from '../db/pool.js';
import fmpService from '../services/fmp-service.js';

const JOB_NAME = 'DailyPriceUpdate';
const BATCH_SIZE = 200;
const MAX_RETRIES = 3;

/**
 * Main job execution.
 */
export async function run() {
  console.log(`[${JOB_NAME}] Starting daily price update...`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Get all active securities that need pricing
    const securities = await getSecuritiesToPrice();
    
    if (securities.length === 0) {
      console.log(`[${JOB_NAME}] No securities to price. Exiting.`);
      return { success: true, securitiesProcessed: 0 };
    }
    
    console.log(`[${JOB_NAME}] Found ${securities.length} securities to price`);
    
    // Step 2: Extract symbols and batch them
    const symbols = securities.map(s => s.symbol);
    const batches = chunkArray(symbols, BATCH_SIZE);
    
    console.log(`[${JOB_NAME}] Processing ${batches.length} batches...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Step 3: Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[${JOB_NAME}] Processing batch ${i + 1}/${batches.length} (${batch.length} symbols)...`);
      
      try {
        const quotes = await fmpService.getQuotes(batch);
        
        // Step 4: Upsert prices
        for (const quote of quotes) {
          const security = securities.find(s => s.symbol === quote.symbol);
          if (security) {
            await fmpService.upsertDailyPrices(security.id, [quote]);
            successCount++;
          }
        }
        
        console.log(`[${JOB_NAME}] Batch ${i + 1} complete: ${quotes.length} prices fetched`);
      } catch (error) {
        console.error(`[${JOB_NAME}] Batch ${i + 1} failed:`, error.message);
        failureCount += batch.length;
      }
    }
    
    // Step 5: Update job log
    const duration = Date.now() - startTime;
    const result = {
      success: true,
      securitiesProcessed: securities.length,
      successCount,
      failureCount,
      durationMs: duration,
    };
    
    await logJobRun(result);
    
    console.log(`[${JOB_NAME}] Complete:`, result);
    
    return result;
  } catch (error) {
    console.error(`[${JOB_NAME}] Fatal error:`, error);
    
    const result = {
      success: false,
      error: error.message,
      durationMs: Date.now() - startTime,
    };
    
    await logJobRun(result);
    
    throw error;
  }
}

/**
 * Get all securities that need pricing.
 * @returns {Promise<Array>} Array of { id, symbol, fmp_symbol_raw }
 */
async function getSecuritiesToPrice() {
  const result = await query(
    `SELECT id, symbol, fmp_symbol_raw
     FROM security_master
     WHERE is_active = true
       AND last_seen_date IS NOT NULL
     ORDER BY last_seen_date DESC`
  );
  
  return result.rows;
}

/**
 * Chunk array into batches.
 * @param {Array} array - Input array
 * @param {number} size - Batch size
 * @returns {Array} Array of batches
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Log job execution to database.
 * @param {Object} result - Job result object
 */
async function logJobRun(result) {
  try {
    await query(
      `INSERT INTO job_log (
        job_name, status, result_json, duration_ms
      ) VALUES ($1, $2, $3, $4)`,
      [
        JOB_NAME,
        result.success ? 'success' : 'failed',
        JSON.stringify(result),
        result.durationMs,
      ]
    );
  } catch (error) {
    console.error(`[${JOB_NAME}] Failed to log job run:`, error.message);
  }
}

/**
 * Run with error handling and retries.
 */
export async function runWithRetry(maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await run();
    } catch (error) {
      console.error(`[${JOB_NAME}] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error(`[${JOB_NAME}] All retries exhausted. Job failed.`);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`[${JOB_NAME}] Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// If running directly (node daily-price-update.js)
if (import.meta.url === `file://${process.argv[1]}`) {
  runWithRetry()
    .then(result => {
      console.log('[Daily Price Update] Job completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[Daily Price Update] Job failed:', error);
      process.exit(1);
    });
}

export default { run, runWithRetry };
