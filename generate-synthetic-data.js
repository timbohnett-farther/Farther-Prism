#!/usr/bin/env node
/**
 * Generate Synthetic Market Data
 * Creates realistic historical returns based on actual market statistics
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Load B2 credentials
const envPath = path.join(process.cwd(), '.env.backblaze');
const envContent = fs.readFileSync(envPath, 'utf-8');
const b2Config = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) b2Config[key.trim()] = value.trim();
  }
});

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: `https://${b2Config.BACKBLAZE_ENDPOINT}`,
  region: b2Config.BACKBLAZE_REGION,
  credentials: {
    accessKeyId: b2Config.BACKBLAZE_KEY_ID,
    secretAccessKey: b2Config.BACKBLAZE_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = b2Config.BACKBLAZE_BUCKET_NAME;

/**
 * Upload to B2
 */
async function uploadToB2(key, data, contentType = 'application/json') {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    ContentType: contentType,
  });
  
  try {
    await s3Client.send(command);
    console.log(`✅ Uploaded: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${key}:`, error.message);
    return false;
  }
}

/**
 * Asset class definitions with realistic historical statistics
 */
const assetClasses = [
  {
    symbol: 'SPY',
    name: 'S&P 500',
    assetClass: 'US Large Cap Equity',
    annualReturn: 0.10,      // 10% historical
    annualVolatility: 0.18,  // 18% vol
    startPrice: 100
  },
  {
    symbol: 'IWM',
    name: 'Russell 2000',
    assetClass: 'US Small Cap Equity',
    annualReturn: 0.11,
    annualVolatility: 0.22,
    startPrice: 50
  },
  {
    symbol: 'EFA',
    name: 'MSCI EAFE',
    assetClass: 'International Developed Equity',
    annualReturn: 0.08,
    annualVolatility: 0.20,
    startPrice: 60
  },
  {
    symbol: 'EEM',
    name: 'MSCI Emerging Markets',
    assetClass: 'Emerging Markets Equity',
    annualReturn: 0.09,
    annualVolatility: 0.25,
    startPrice: 40
  },
  {
    symbol: 'AGG',
    name: 'US Aggregate Bond',
    assetClass: 'US Investment Grade Bonds',
    annualReturn: 0.04,
    annualVolatility: 0.05,
    startPrice: 100
  },
  {
    symbol: 'TLT',
    name: 'Long-Term Treasury',
    assetClass: 'US Long-Term Government Bonds',
    annualReturn: 0.05,
    annualVolatility: 0.12,
    startPrice: 90
  },
  {
    symbol: 'VNQ',
    name: 'US Real Estate',
    assetClass: 'US Real Estate',
    annualReturn: 0.09,
    annualVolatility: 0.20,
    startPrice: 70
  },
  {
    symbol: 'GLD',
    name: 'Gold',
    assetClass: 'Commodities - Gold',
    annualReturn: 0.06,
    annualVolatility: 0.16,
    startPrice: 80
  }
];

/**
 * Box-Muller transform for generating normally distributed random numbers
 */
function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

/**
 * Generate daily returns using geometric Brownian motion
 */
function generateDailyReturns(annualReturn, annualVolatility, tradingDays) {
  // Convert annual to daily
  const dailyReturn = annualReturn / 252;
  const dailyVolatility = annualVolatility / Math.sqrt(252);
  
  const returns = [];
  for (let i = 0; i < tradingDays; i++) {
    const randomReturn = gaussianRandom(dailyReturn, dailyVolatility);
    returns.push(randomReturn);
  }
  
  return returns;
}

/**
 * Generate price series from returns
 */
function generatePriceSeries(startPrice, returns) {
  const prices = [startPrice];
  
  for (let i = 0; i < returns.length; i++) {
    const prevPrice = prices[i];
    const newPrice = prevPrice * (1 + returns[i]);
    prices.push(newPrice);
  }
  
  return prices;
}

/**
 * Generate trading days (exclude weekends)
 */
function generateTradingDays(startDate, endDate) {
  const days = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Main generation function
 */
async function main() {
  console.log('🎲 Generating synthetic market data...\n');
  
  const startDate = '2000-01-03'; // First trading day of 2000
  const endDate = new Date().toISOString().split('T')[0];
  
  console.log(`Date range: ${startDate} to ${endDate}\n`);
  
  // Generate trading days
  const tradingDays = generateTradingDays(startDate, endDate);
  console.log(`Generated ${tradingDays.length} trading days\n`);
  
  // Generate data for each asset class
  for (const asset of assetClasses) {
    console.log(`📊 Generating ${asset.symbol} (${asset.name})...`);
    
    // Generate returns
    const returns = generateDailyReturns(
      asset.annualReturn,
      asset.annualVolatility,
      tradingDays.length
    );
    
    // Generate prices
    const prices = generatePriceSeries(asset.startPrice, returns);
    
    // Create OHLCV data (synthetic intraday range)
    const ohlcv = [];
    for (let i = 0; i < tradingDays.length; i++) {
      const close = prices[i + 1];
      const open = prices[i];
      const range = close * 0.02; // 2% intraday range
      const high = close + Math.random() * range;
      const low = close - Math.random() * range;
      const volume = Math.floor(Math.random() * 100000000) + 50000000;
      
      ohlcv.push({
        Date: tradingDays[i].toISOString().split('T')[0],
        Open: open.toFixed(2),
        High: high.toFixed(2),
        Low: low.toFixed(2),
        Close: close.toFixed(2),
        'Adj Close': close.toFixed(2),
        Volume: volume
      });
    }
    
    // Convert to CSV
    const csv = [
      'Date,Open,High,Low,Close,Adj Close,Volume',
      ...ohlcv.map(d => `${d.Date},${d.Open},${d.High},${d.Low},${d.Close},${d['Adj Close']},${d.Volume}`)
    ].join('\n');
    
    // Upload CSV
    await uploadToB2(
      `market-data/daily-prices/${asset.symbol}.csv`,
      csv,
      'text/csv'
    );
    
    // Upload metadata
    await uploadToB2(
      `market-data/daily-prices/${asset.symbol}-metadata.json`,
      {
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.assetClass,
        synthetic: true,
        parameters: {
          annualReturn: asset.annualReturn,
          annualVolatility: asset.annualVolatility,
          startPrice: asset.startPrice
        },
        startDate,
        endDate,
        recordCount: ohlcv.length,
        lastUpdated: new Date().toISOString(),
      }
    );
    
    console.log(`  ✓ Generated ${ohlcv.length} records (${startDate} to ${endDate})\n`);
  }
  
  // Generate correlation matrix (realistic correlations)
  const correlations = {
    metadata: {
      description: 'Historical correlation matrix for asset classes',
      period: '2000-2026',
      synthetic: true,
      lastUpdated: new Date().toISOString()
    },
    matrix: {
      'SPY': { 'SPY': 1.00, 'IWM': 0.85, 'EFA': 0.80, 'EEM': 0.70, 'AGG': -0.10, 'TLT': -0.20, 'VNQ': 0.60, 'GLD': 0.05 },
      'IWM': { 'SPY': 0.85, 'IWM': 1.00, 'EFA': 0.75, 'EEM': 0.65, 'AGG': -0.05, 'TLT': -0.15, 'VNQ': 0.55, 'GLD': 0.10 },
      'EFA': { 'SPY': 0.80, 'IWM': 0.75, 'EFA': 1.00, 'EEM': 0.75, 'AGG': -0.05, 'TLT': -0.10, 'VNQ': 0.50, 'GLD': 0.15 },
      'EEM': { 'SPY': 0.70, 'IWM': 0.65, 'EFA': 0.75, 'EEM': 1.00, 'AGG': 0.00, 'TLT': -0.05, 'VNQ': 0.45, 'GLD': 0.20 },
      'AGG': { 'SPY': -0.10, 'IWM': -0.05, 'EFA': -0.05, 'EEM': 0.00, 'AGG': 1.00, 'TLT': 0.80, 'VNQ': 0.10, 'GLD': 0.25 },
      'TLT': { 'SPY': -0.20, 'IWM': -0.15, 'EFA': -0.10, 'EEM': -0.05, 'AGG': 0.80, 'TLT': 1.00, 'VNQ': 0.05, 'GLD': 0.30 },
      'VNQ': { 'SPY': 0.60, 'IWM': 0.55, 'EFA': 0.50, 'EEM': 0.45, 'AGG': 0.10, 'TLT': 0.05, 'VNQ': 1.00, 'GLD': 0.15 },
      'GLD': { 'SPY': 0.05, 'IWM': 0.10, 'EFA': 0.15, 'EEM': 0.20, 'AGG': 0.25, 'TLT': 0.30, 'VNQ': 0.15, 'GLD': 1.00 }
    }
  };
  
  await uploadToB2('market-data/correlations/asset-class-correlations.json', correlations);
  
  // Generate capital market assumptions
  const cma = {
    metadata: {
      description: '10-year forward-looking capital market assumptions',
      asOfDate: new Date().toISOString().split('T')[0],
      horizon: '10 years',
      source: 'Synthetic (based on historical averages)',
      lastUpdated: new Date().toISOString()
    },
    assumptions: assetClasses.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      assetClass: asset.assetClass,
      expectedReturn: asset.annualReturn,
      expectedVolatility: asset.annualVolatility,
      sharpeRatio: (asset.annualReturn - 0.02) / asset.annualVolatility // Assume 2% risk-free rate
    }))
  };
  
  await uploadToB2('cma/2026-Q1-expected-returns.json', cma);
  
  // Generate data dictionary
  const dataDictionary = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    description: 'FartherData data lake catalog and schema documentation',
    directories: {
      'market-data/daily-prices/': {
        description: 'Daily OHLCV price data for major asset class ETFs',
        format: 'CSV',
        schema: 'Date,Open,High,Low,Close,Adj Close,Volume',
        updateFrequency: 'Daily (when real data feeds enabled)',
        dataType: 'Synthetic (generated from statistical models)',
        coverage: '2000-01-03 to present'
      },
      'market-data/correlations/': {
        description: 'Asset class correlation matrices',
        format: 'JSON',
        updateFrequency: 'Quarterly',
        dataType: 'Synthetic'
      },
      'cma/': {
        description: 'Capital Market Assumptions - forward-looking return/risk expectations',
        format: 'JSON',
        updateFrequency: 'Quarterly',
        dataType: 'Synthetic (based on historical statistics)'
      }
    },
    assetClasses: assetClasses.map(a => ({
      symbol: a.symbol,
      name: a.name,
      assetClass: a.assetClass
    }))
  };
  
  await uploadToB2('metadata/data-dictionary.json', dataDictionary);
  
  console.log('\n✅ Synthetic market data generation complete!');
  console.log('\n📊 Summary:');
  console.log(`   - ${assetClasses.length} asset classes`);
  console.log(`   - ${tradingDays.length} trading days (${startDate} to ${endDate})`);
  console.log(`   - Correlation matrix generated`);
  console.log(`   - Capital market assumptions generated`);
  console.log(`   - Data dictionary generated`);
  console.log('\n🎯 Prism can now run Monte Carlo simulations!');
}

main().catch(console.error);
