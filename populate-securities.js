#!/usr/bin/env node
/**
 * Populate Securities Data
 * 
 * Fetches historical price data for popular stocks, ETFs, bonds and uploads to Backblaze data lake.
 * Run with: node populate-securities.js [category]
 * Categories: stocks, etfs, bonds, international, sectors, all
 */

import 'dotenv/config';
import { SecuritiesDataService } from './src/services/securities-data-service.js';

async function main() {
  const category = process.argv[2] || 'etfs'; // Default to ETFs
  const service = new SecuritiesDataService();
  const securities = SecuritiesDataService.getPopularSecurities();
  
  let symbolsToFetch = [];
  
  if (category === 'all') {
    symbolsToFetch = [
      ...securities.stocks,
      ...securities.etfs,
      ...securities.bonds,
      ...securities.international,
      ...securities.sectors,
    ];
  } else if (securities[category]) {
    symbolsToFetch = securities[category];
  } else {
    console.error(`❌ Unknown category: ${category}`);
    console.log('Available categories: stocks, etfs, bonds, international, sectors, all');
    process.exit(1);
  }
  
  // Remove duplicates
  symbolsToFetch = [...new Set(symbolsToFetch)];
  
  console.log(`🚀 Populating ${symbolsToFetch.length} securities from category: ${category}\n`);
  console.log('Symbols:', symbolsToFetch.join(', '), '\n');
  
  const startDate = '2015-01-01'; // Last 10 years
  const endDate = new Date().toISOString().split('T')[0];
  
  console.log(`Date range: ${startDate} to ${endDate}\n`);
  
  const results = await service.fetchSecurities(symbolsToFetch, {
    startDate,
    endDate,
    source: 'auto', // Will use FMP/AlphaVantage if keys available, otherwise synthetic
  });
  
  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n✅ Summary:');
  console.log(`   Success: ${successful.length}/${results.length}`);
  console.log(`   Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    const totalDataPoints = successful.reduce((sum, r) => sum + r.dataPoints, 0);
    console.log(`   Total data points: ${totalDataPoints.toLocaleString()}`);
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed symbols:');
    failed.forEach(r => console.log(`   - ${r.symbol}: ${r.error}`));
  }
  
  console.log('\n✅ Securities data population complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
