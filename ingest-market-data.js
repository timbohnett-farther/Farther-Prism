#!/usr/bin/env node
/**
 * Market Data Ingestion Pipeline
 * Populates Backblaze FartherData lake with historical market data
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import yahooFinance from 'yahoo-finance2';
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

// Initialize S3 client for Backblaze
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
 * Upload data to B2
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
 * Fetch market data from Yahoo Finance using yahoo-finance2
 */
async function fetchYahooFinance(symbol, startDate, endDate) {
  try {
    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    if (!result || result.length === 0) {
      console.error(`No data returned for ${symbol}`);
      return null;
    }
    
    // Convert to CSV-like format for consistency
    const data = result.map(item => ({
      Date: item.date.toISOString().split('T')[0],
      Open: item.open,
      High: item.high,
      Low: item.low,
      Close: item.close,
      'Adj Close': item.adjClose || item.close,
      Volume: item.volume || 0
    }));
    
    console.log(`  → Fetched ${data.length} records for ${symbol}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Main ingestion pipeline
 */
async function main() {
  console.log('🚀 Starting market data ingestion pipeline...\n');
  
  // Define tickers and date range
  const tickers = [
    { symbol: 'SPY', name: 'S&P 500', assetClass: 'US Large Cap' },
    { symbol: 'IWM', name: 'Russell 2000', assetClass: 'US Small Cap' },
    { symbol: 'EFA', name: 'MSCI EAFE', assetClass: 'International Developed' },
    { symbol: 'EEM', name: 'MSCI Emerging Markets', assetClass: 'Emerging Markets' },
    { symbol: 'AGG', name: 'US Aggregate Bond', assetClass: 'US Bonds' },
    { symbol: 'TLT', name: 'Long-Term Treasury', assetClass: 'Long-Term Bonds' },
    { symbol: 'VNQ', name: 'US Real Estate', assetClass: 'Real Estate' },
    { symbol: 'GLD', name: 'Gold', assetClass: 'Commodities' },
  ];
  
  const startDate = '2000-01-01';
  const endDate = new Date().toISOString().split('T')[0];
  
  console.log(`Fetching data from ${startDate} to ${endDate}\n`);
  
  // Fetch and upload each ticker
  for (const ticker of tickers) {
    console.log(`📊 Processing ${ticker.symbol} (${ticker.name})...`);
    
    const data = await fetchYahooFinance(ticker.symbol, startDate, endDate);
    
    if (data && data.length > 0) {
      // Upload as CSV (original format)
      const csv = [
        'Date,Open,High,Low,Close,Adj Close,Volume',
        ...data.map(d => `${d.Date},${d.Open},${d.High},${d.Low},${d.Close},${d['Adj Close']},${d.Volume}`)
      ].join('\n');
      
      await uploadToB2(
        `market-data/daily-prices/${ticker.symbol}.csv`,
        csv,
        'text/csv'
      );
      
      // Upload metadata
      await uploadToB2(
        `market-data/daily-prices/${ticker.symbol}-metadata.json`,
        {
          symbol: ticker.symbol,
          name: ticker.name,
          assetClass: ticker.assetClass,
          startDate,
          endDate,
          recordCount: data.length,
          lastUpdated: new Date().toISOString(),
        }
      );
      
      console.log(`  ✓ ${data.length} records uploaded\n`);
    }
    
    // Rate limit to avoid Yahoo Finance throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ Market data ingestion complete!');
}

main().catch(console.error);
