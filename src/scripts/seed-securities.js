/**
 * One-Time Security Master Seeding Script
 * 
 * Populates security_master table with all available symbols from FMP.
 * Run once during initial setup to get good symbol coverage.
 * 
 * Usage:
 *   node src/scripts/seed-securities.js
 * 
 * Options:
 *   --limit=N    Only import first N symbols (for testing)
 *   --exchanges  Comma-separated list of exchanges (e.g., "NASDAQ,NYSE")
 */

import { query } from '../db/pool.js';
import fmpService from '../services/fmp-service.js';

const args = process.argv.slice(2);
const options = {
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || null,
  exchanges: args.find(a => a.startsWith('--exchanges='))?.split('=')[1]?.split(',') || null,
};

async function seedSecurities() {
  console.log('[Seed Securities] Starting...');
  console.log('[Seed Securities] Options:', options);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Fetch all symbols from FMP
    console.log('[Seed Securities] Fetching symbol list from FMP...');
    let symbols = await fmpService.getAllSymbols();
    console.log(`[Seed Securities] Received ${symbols.length} symbols from FMP`);
    
    // Step 2: Filter by exchange if specified
    if (options.exchanges) {
      symbols = symbols.filter(s => options.exchanges.includes(s.exchangeShortName));
      console.log(`[Seed Securities] Filtered to ${symbols.length} symbols (exchanges: ${options.exchanges.join(', ')})`);
    }
    
    // Step 3: Limit if specified
    if (options.limit) {
      symbols = symbols.slice(0, options.limit);
      console.log(`[Seed Securities] Limited to ${symbols.length} symbols`);
    }
    
    // Step 4: Insert into security_master
    console.log('[Seed Securities] Inserting into database...');
    
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const symbol of symbols) {
      try {
        const result = await query(
          `INSERT INTO security_master (
            symbol, name, exchange, currency, security_type,
            fmp_symbol_raw, asset_class, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (symbol) DO NOTHING
          RETURNING id`,
          [
            symbol.symbol,
            symbol.name,
            symbol.exchangeShortName,
            symbol.currency || 'USD',
            classifySecurityType(symbol.type),
            symbol.symbol,
            classifyAssetClass(symbol.type, symbol.exchangeShortName),
          ]
        );
        
        if (result.rowCount > 0) {
          insertedCount++;
          if (insertedCount % 1000 === 0) {
            console.log(`[Seed Securities] Progress: ${insertedCount} inserted...`);
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(`[Seed Securities] Error inserting ${symbol.symbol}:`, error.message);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('[Seed Securities] Complete!');
    console.log(`  Inserted: ${insertedCount}`);
    console.log(`  Skipped (duplicates): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
    
    // Step 5: Verify
    const counts = await query(`
      SELECT security_type, COUNT(*) AS count
      FROM security_master
      GROUP BY security_type
      ORDER BY count DESC
    `);
    
    console.log('\n[Seed Securities] Security counts by type:');
    counts.rows.forEach(row => {
      console.log(`  ${row.security_type}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('[Seed Securities] Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Classify security type from FMP type string.
 */
function classifySecurityType(fmpType) {
  if (!fmpType) return 'stock';
  
  const type = fmpType.toLowerCase();
  
  if (type.includes('etf')) return 'etf';
  if (type.includes('fund')) return 'fund';
  if (type.includes('trust')) return 'trust';
  if (type.includes('stock') || type.includes('equity')) return 'stock';
  
  return 'other';
}

/**
 * Classify asset class from FMP type and exchange.
 */
function classifyAssetClass(fmpType, exchange) {
  const type = (fmpType || '').toLowerCase();
  
  if (type.includes('etf') || type.includes('fund')) {
    // Would need more logic here to classify ETF asset class
    // For now, default to broad category
    return 'us_equity_large';
  }
  
  if (exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'AMEX') {
    return 'us_equity_large';
  }
  
  if (exchange && !['NASDAQ', 'NYSE', 'AMEX'].includes(exchange)) {
    return 'intl_equity_developed';
  }
  
  return 'us_equity_large';
}

// Run
seedSecurities()
  .then(() => {
    console.log('\n[Seed Securities] Done.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n[Seed Securities] Failed:', error);
    process.exit(1);
  });
