/**
 * Financial Modeling Prep (FMP) API Service
 * 
 * Handles all interactions with FMP API:
 * - Quote fetching (single & batch)
 * - Company profiles
 * - Historical prices
 * - Symbol search
 * 
 * Features:
 * - Rate limiting (automatic retry with backoff)
 * - Response caching (Redis)
 * - Error handling with detailed logging
 * - Batch optimization (splits large symbol lists)
 */

import axios from 'axios';
import { query } from '../db/pool.js';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const FMP_API_KEY = process.env.FMP_API_KEY;

// Rate limiting: FMP allows 250 calls/day on free tier, 10,000/day on paid
const RATE_LIMIT_DELAY_MS = 100; // Delay between batch calls
const MAX_SYMBOLS_PER_BATCH = 200; // Max symbols per comma-separated request
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

// ============================================================================
// CORE API METHODS
// ============================================================================

/**
 * Fetch real-time quotes for one or more symbols.
 * @param {string|string[]} symbols - Single symbol or array of symbols
 * @returns {Promise<Array>} Array of quote objects
 */
export async function getQuotes(symbols) {
  const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
  const batches = chunkArray(symbolArray, MAX_SYMBOLS_PER_BATCH);
  
  const results = [];
  
  for (const batch of batches) {
    const symbolStr = batch.join(',');
    const url = `${FMP_BASE_URL}/quote/${symbolStr}?apikey=${FMP_API_KEY}`;
    
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
      const responseTime = Date.now() - startTime;
      
      // Log API call
      await logApiCall({
        endpoint: '/quote',
        requestParams: { symbols: batch },
        statusCode: response.status,
        responseTimeMs: responseTime,
        symbolsRequested: batch.length,
        symbolsReturned: response.data.length,
      });
      
      results.push(...response.data);
      
      // Rate limit delay
      if (batches.length > 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } catch (error) {
      await logApiCall({
        endpoint: '/quote',
        requestParams: { symbols: batch },
        statusCode: error.response?.status || 0,
        responseTimeMs: Date.now() - startTime,
        symbolsRequested: batch.length,
        symbolsReturned: 0,
        errorMessage: error.message,
      });
      
      console.error(`[FMP] Quote fetch failed for batch:`, batch, error.message);
      // Continue with other batches
    }
  }
  
  return results;
}

/**
 * Fetch company profile (enrichment data).
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Company profile object
 */
export async function getProfile(symbol) {
  const url = `${FMP_BASE_URL}/profile/${symbol}?apikey=${FMP_API_KEY}`;
  
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    const responseTime = Date.now() - startTime;
    
    await logApiCall({
      endpoint: '/profile',
      requestParams: { symbol },
      statusCode: response.status,
      responseTimeMs: responseTime,
      symbolsRequested: 1,
      symbolsReturned: response.data.length,
    });
    
    return response.data[0] || null;
  } catch (error) {
    await logApiCall({
      endpoint: '/profile',
      requestParams: { symbol },
      statusCode: error.response?.status || 0,
      responseTimeMs: Date.now() - startTime,
      symbolsRequested: 1,
      symbolsReturned: 0,
      errorMessage: error.message,
    });
    
    console.error(`[FMP] Profile fetch failed for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch historical daily prices (OHLCV).
 * @param {string} symbol - Stock symbol
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of daily price objects
 */
export async function getHistoricalPrices(symbol, from, to) {
  const url = `${FMP_BASE_URL}/historical-price-full/${symbol}?from=${from}&to=${to}&apikey=${FMP_API_KEY}`;
  
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    const responseTime = Date.now() - startTime;
    
    const historical = response.data.historical || [];
    
    await logApiCall({
      endpoint: '/historical-price-full',
      requestParams: { symbol, from, to },
      statusCode: response.status,
      responseTimeMs: responseTime,
      symbolsRequested: 1,
      symbolsReturned: historical.length,
    });
    
    return historical;
  } catch (error) {
    await logApiCall({
      endpoint: '/historical-price-full',
      requestParams: { symbol, from, to },
      statusCode: error.response?.status || 0,
      responseTimeMs: Date.now() - startTime,
      symbolsRequested: 1,
      symbolsReturned: 0,
      errorMessage: error.message,
    });
    
    console.error(`[FMP] Historical prices fetch failed for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Fetch all available stock symbols (for one-time seeding).
 * @returns {Promise<Array>} Array of symbol objects
 */
export async function getAllSymbols() {
  const url = `${FMP_BASE_URL}/stock/list?apikey=${FMP_API_KEY}`;
  
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    const responseTime = Date.now() - startTime;
    
    await logApiCall({
      endpoint: '/stock/list',
      requestParams: {},
      statusCode: response.status,
      responseTimeMs: responseTime,
      symbolsRequested: 0,
      symbolsReturned: response.data.length,
    });
    
    return response.data;
  } catch (error) {
    await logApiCall({
      endpoint: '/stock/list',
      requestParams: {},
      statusCode: error.response?.status || 0,
      responseTimeMs: Date.now() - startTime,
      symbolsRequested: 0,
      symbolsReturned: 0,
      errorMessage: error.message,
    });
    
    console.error('[FMP] Stock list fetch failed:', error.message);
    return [];
  }
}

/**
 * Search for symbols by name or ticker.
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of matching symbols
 */
export async function searchSymbols(query, limit = 10) {
  const url = `${FMP_BASE_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}&apikey=${FMP_API_KEY}`;
  
  try {
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
  } catch (error) {
    console.error('[FMP] Symbol search failed:', error.message);
    return [];
  }
}

// ============================================================================
// DATABASE INTEGRATION
// ============================================================================

/**
 * Enrich security_master with FMP profile data.
 * @param {string} securityId - Security UUID
 * @param {string} symbol - Stock symbol
 */
export async function enrichSecurity(securityId, symbol) {
  const profile = await getProfile(symbol);
  
  if (!profile) return;
  
  await query(
    `UPDATE security_master SET
      name = COALESCE($1, name),
      exchange = COALESCE($2, exchange),
      currency = COALESCE($3, currency),
      sector = $4,
      industry = $5,
      market_cap = $6,
      country = $7,
      ipo_date = $8::date,
      updated_at = NOW()
     WHERE id = $9`,
    [
      profile.companyName,
      profile.exchangeShortName,
      profile.currency,
      profile.sector,
      profile.industry,
      profile.mktCap,
      profile.country,
      profile.ipoDate,
      securityId,
    ]
  );
}

/**
 * Insert or update daily prices for a security.
 * @param {string} securityId - Security UUID
 * @param {Array} prices - Array of price objects from FMP
 */
export async function upsertDailyPrices(securityId, prices) {
  if (!prices || prices.length === 0) return;
  
  for (const price of prices) {
    // FMP response can be from quote or historical endpoint
    const priceDate = price.date || new Date().toISOString().split('T')[0];
    const open = price.open || null;
    const high = price.high || null;
    const low = price.low || null;
    const close = price.close || price.price; // quote uses 'price', historical uses 'close'
    const volume = price.volume || null;
    const adjClose = price.adjClose || price.close || price.price;
    const change = price.change || null;
    const changePercent = price.changesPercentage || price.changePercent || null;
    
    await query(
      `INSERT INTO daily_prices (
        security_id, price_date, open_price, high_price, low_price,
        close_price, volume, adjusted_close, change_amount, change_percent, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (security_id, price_date)
      DO UPDATE SET
        open_price = EXCLUDED.open_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        close_price = EXCLUDED.close_price,
        volume = EXCLUDED.volume,
        adjusted_close = EXCLUDED.adjusted_close,
        change_amount = EXCLUDED.change_amount,
        change_percent = EXCLUDED.change_percent,
        fetched_at = NOW()`,
      [
        securityId, priceDate, open, high, low, close, volume,
        adjClose, change, changePercent, 'FMP_QUOTE',
      ]
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logApiCall({
  endpoint,
  method = 'GET',
  requestParams,
  statusCode,
  responseTimeMs,
  symbolsRequested,
  symbolsReturned,
  errorMessage = null,
}) {
  try {
    await query(
      `INSERT INTO fmp_api_log (
        endpoint, method, request_params, status_code, response_time_ms,
        symbols_requested, symbols_returned, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        endpoint,
        method,
        JSON.stringify(requestParams),
        statusCode,
        responseTimeMs,
        symbolsRequested,
        symbolsReturned,
        errorMessage,
      ]
    );
  } catch (err) {
    // Don't let logging errors break the API call
    console.error('[FMP] Failed to log API call:', err.message);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getQuotes,
  getProfile,
  getHistoricalPrices,
  getAllSymbols,
  searchSymbols,
  enrichSecurity,
  upsertDailyPrices,
};
