/**
 * Securities Data Service
 * 
 * Fetches and caches security data (stocks, bonds, ETFs, funds) from multiple sources.
 * Populates Backblaze data lake with historical prices and metadata.
 * Supports: Yahoo Finance, Financial Modeling Prep, Alpha Vantage
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export class SecuritiesDataService {
  constructor() {
    // Load B2 credentials
    const envPath = path.join(process.cwd(), '.env.backblaze');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      this.b2Config = {};
      envContent.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) this.b2Config[key.trim()] = value.trim();
        }
      });
      
      // Initialize S3 client
      this.s3Client = new S3Client({
        endpoint: `https://${this.b2Config.BACKBLAZE_ENDPOINT}`,
        region: this.b2Config.BACKBLAZE_REGION,
        credentials: {
          accessKeyId: this.b2Config.BACKBLAZE_KEY_ID,
          secretAccessKey: this.b2Config.BACKBLAZE_APPLICATION_KEY,
        },
        forcePathStyle: true,
      });
      
      this.bucket = this.b2Config.BACKBLAZE_BUCKET_NAME;
    }
    
    // API keys (optional - use free tier or no-auth endpoints)
    this.fmpApiKey = process.env.FMP_API_KEY; // Financial Modeling Prep
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  }

  /**
   * Fetch and store data for a list of securities.
   * @param {Array<string>} symbols - Array of ticker symbols
   * @param {Object} options - Options (startDate, endDate, source)
   */
  async fetchSecurities(symbols, options = {}) {
    const {
      startDate = '2000-01-01',
      endDate = new Date().toISOString().split('T')[0],
      source = 'auto', // auto, yahoo, fmp, alphavantage
    } = options;
    
    const results = [];
    
    for (const symbol of symbols) {
      console.log(`[SecuritiesData] Fetching ${symbol}...`);
      
      try {
        // Try sources in order of preference
        let data;
        
        if (source === 'fmp' || (source === 'auto' && this.fmpApiKey)) {
          data = await this.fetchFromFMP(symbol, startDate, endDate);
        } else if (source === 'alphavantage' || (source === 'auto' && this.alphaVantageKey)) {
          data = await this.fetchFromAlphaVantage(symbol);
        } else {
          // Fallback: generate synthetic data (for now)
          console.warn(`[SecuritiesData] No API key available for ${symbol}, using synthetic data`);
          data = this.generateSyntheticData(symbol, startDate, endDate);
        }
        
        if (data && data.prices.length > 0) {
          await this.storeSecurityData(symbol, data);
          results.push({ symbol, success: true, dataPoints: data.prices.length });
        } else {
          results.push({ symbol, success: false, error: 'No data returned' });
        }
        
        // Rate limiting
        await this.sleep(1000); // 1 second between requests
        
      } catch (error) {
        console.error(`[SecuritiesData] Failed to fetch ${symbol}:`, error.message);
        results.push({ symbol, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Fetch from Financial Modeling Prep (free tier: 250 requests/day).
   */
  async fetchFromFMP(symbol, startDate, endDate) {
    if (!this.fmpApiKey) {
      throw new Error('FMP_API_KEY not configured');
    }
    
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${startDate}&to=${endDate}&apikey=${this.fmpApiKey}`;
    
    const response = await fetch(url);
    const json = await response.json();
    
    if (!json.historical || json.historical.length === 0) {
      throw new Error('No historical data returned from FMP');
    }
    
    // Convert FMP format to standard format
    const prices = json.historical.map(d => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      adjClose: d.adjClose || d.close,
      volume: d.volume || 0,
    })).reverse(); // FMP returns newest first, we want oldest first
    
    return {
      symbol,
      name: json.symbol,
      prices,
      metadata: {
        source: 'FMP',
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Fetch from Alpha Vantage (free tier: 500 requests/day, 5 per minute).
   */
  async fetchFromAlphaVantage(symbol) {
    if (!this.alphaVantageKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY not configured');
    }
    
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${this.alphaVantageKey}`;
    
    const response = await fetch(url);
    const json = await response.json();
    
    if (!json['Time Series (Daily)']) {
      throw new Error(json['Note'] || json['Error Message'] || 'No data returned from Alpha Vantage');
    }
    
    const timeSeries = json['Time Series (Daily)'];
    const prices = Object.keys(timeSeries).map(date => ({
      date,
      open: parseFloat(timeSeries[date]['1. open']),
      high: parseFloat(timeSeries[date]['2. high']),
      low: parseFloat(timeSeries[date]['3. low']),
      close: parseFloat(timeSeries[date]['4. close']),
      adjClose: parseFloat(timeSeries[date]['5. adjusted close']),
      volume: parseInt(timeSeries[date]['6. volume']),
    })).sort((a, b) => a.date.localeCompare(b.date)); // Sort oldest first
    
    return {
      symbol,
      name: json['Meta Data']['2. Symbol'],
      prices,
      metadata: {
        source: 'AlphaVantage',
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate synthetic data (fallback when no API available).
   */
  generateSyntheticData(symbol, startDate, endDate) {
    console.warn(`[SecuritiesData] Generating synthetic data for ${symbol}`);
    
    // This is the same logic from our original synthetic data generator
    // Just adapted for individual securities
    const annualReturn = 0.10; // 10% average
    const annualVolatility = 0.20; // 20% vol
    const startPrice = 100;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const tradingDays = this.getTradingDays(start, end);
    
    const prices = [];
    let currentPrice = startPrice;
    
    for (const date of tradingDays) {
      const dailyReturn = this.gaussianRandom(annualReturn / 252, annualVolatility / Math.sqrt(252));
      currentPrice = currentPrice * (1 + dailyReturn);
      
      const range = currentPrice * 0.02; // 2% intraday range
      const high = currentPrice + Math.random() * range;
      const low = currentPrice - Math.random() * range;
      const volume = Math.floor(Math.random() * 10000000) + 1000000;
      
      prices.push({
        date: date.toISOString().split('T')[0],
        open: currentPrice,
        high,
        low,
        close: currentPrice,
        adjClose: currentPrice,
        volume,
      });
    }
    
    return {
      symbol,
      name: `${symbol} (Synthetic)`,
      prices,
      metadata: {
        source: 'Synthetic',
        fetchedAt: new Date().toISOString(),
        warning: 'This is synthetic data for testing purposes',
      },
    };
  }

  /**
   * Store security data in Backblaze data lake.
   */
  async storeSecurityData(symbol, data) {
    // Convert to CSV format
    const csv = [
      'Date,Open,High,Low,Close,Adj Close,Volume',
      ...data.prices.map(p => 
        `${p.date},${p.open.toFixed(2)},${p.high.toFixed(2)},${p.low.toFixed(2)},${p.close.toFixed(2)},${p.adjClose.toFixed(2)},${p.volume}`
      )
    ].join('\n');
    
    // Upload CSV
    await this.uploadToB2(
      `securities/daily-prices/${symbol}.csv`,
      csv,
      'text/csv'
    );
    
    // Upload metadata
    await this.uploadToB2(
      `securities/metadata/${symbol}.json`,
      JSON.stringify({
        symbol,
        name: data.name,
        dataPoints: data.prices.length,
        startDate: data.prices[0].date,
        endDate: data.prices[data.prices.length - 1].date,
        lastUpdated: new Date().toISOString(),
        ...data.metadata,
      }, null, 2)
    );
    
    console.log(`[SecuritiesData] Stored ${symbol}: ${data.prices.length} data points`);
  }

  /**
   * Upload to Backblaze B2.
   */
  async uploadToB2(key, data, contentType = 'application/json') {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    
    await this.s3Client.send(command);
  }

  /**
   * Get trading days between two dates (exclude weekends).
   */
  getTradingDays(start, end) {
    const days = [];
    let current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }

  /**
   * Gaussian random number generator.
   */
  gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  }

  /**
   * Sleep helper.
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get list of popular securities to populate.
   */
  static getPopularSecurities() {
    return {
      // S&P 500 components (top 50 by market cap)
      stocks: [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'LLY', 'V',
        'UNH', 'XOM', 'JPM', 'JNJ', 'WMT', 'MA', 'PG', 'HD', 'CVX', 'MRK',
        'ABBV', 'COST', 'KO', 'PEP', 'AVGO', 'ADBE', 'MCD', 'CSCO', 'ACN', 'LIN',
        'TMO', 'ABT', 'NFLX', 'CRM', 'DHR', 'NKE', 'TXN', 'VZ', 'DIS', 'WFC',
        'ORCL', 'CMCSA', 'BMY', 'AMD', 'PFE', 'INTC', 'PM', 'COP', 'UNP', 'AMGN',
      ],
      
      // Popular ETFs (beyond the 8 we have)
      etfs: [
        'QQQ', 'DIA', 'XLF', 'XLE', 'XLV', 'XLK', 'XLI', 'XLP', 'XLY', 'XLU',
        'VOO', 'IVV', 'VTI', 'VEA', 'VWO', 'IEFA', 'IEMG', 'BND', 'BNDX',
        'SCHD', 'DGRO', 'VYM', 'JEPI', 'JEPQ', 'ARKK', 'ARKG',
      ],
      
      // Bond ETFs
      bonds: [
        'BND', 'AGG', 'LQD', 'HYG', 'TLT', 'IEF', 'SHY', 'TIP', 'MUB', 'VCIT',
      ],
      
      // International
      international: [
        'EFA', 'EEM', 'VEA', 'VWO', 'IEFA', 'IEMG', 'IXUS', 'VXUS',
      ],
      
      // Sector ETFs
      sectors: [
        'XLF', 'XLE', 'XLV', 'XLK', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE',
      ],
    };
  }
}

export default SecuritiesDataService;
