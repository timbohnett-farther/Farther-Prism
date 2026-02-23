/**
 * Symbol Resolution Service
 * 
 * Maps raw user-provided symbols to security_master entries.
 * Implements the "growing universe" pattern:
 * 1. Check if symbol exists in security_master
 * 2. If found, update last_seen_date
 * 3. If not found, create new entry and optionally enrich with FMP
 * 4. Track all requests in client_requests table
 */

import { query } from '../db/pool.js';
import fmpService from './fmp-service.js';

/**
 * Resolve a single symbol to a security_master entry.
 * @param {string} rawSymbol - User-provided symbol (e.g., "AAPL", "BRK.B")
 * @param {Object} context - Request context (householdId, requestType)
 * @returns {Promise<Object>} { securityId, symbol, name, found }
 */
export async function resolveSymbol(rawSymbol, context = {}) {
  const { householdId = null, requestType = 'unknown' } = context;
  
  // Normalize symbol (uppercase, trim whitespace)
  const normalizedSymbol = rawSymbol.trim().toUpperCase();
  
  // Step 1: Check if symbol exists in security_master
  let security = await query(
    'SELECT * FROM security_master WHERE symbol = $1 OR fmp_symbol_raw = $1',
    [normalizedSymbol]
  );
  
  let securityId;
  let resolutionStatus = 'mapped';
  let resolutionNotes = null;
  
  if (security.rows.length > 0) {
    // Found existing security
    security = security.rows[0];
    securityId = security.id;
    
    // Update last_seen_date
    await query(
      'UPDATE security_master SET last_seen_date = CURRENT_DATE WHERE id = $1',
      [securityId]
    );
  } else {
    // New symbol - create security_master entry
    try {
      const newSecurity = await createSecurity(normalizedSymbol);
      securityId = newSecurity.id;
      security = newSecurity;
      resolutionNotes = 'Created new security entry';
    } catch (error) {
      resolutionStatus = 'failed';
      resolutionNotes = error.message;
      securityId = null;
    }
  }
  
  // Step 2: Log request in client_requests
  await query(
    `INSERT INTO client_requests (
      household_id, request_type, raw_symbol, security_id,
      resolution_status, resolution_notes
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [householdId, requestType, rawSymbol, securityId, resolutionStatus, resolutionNotes]
  );
  
  return {
    securityId,
    symbol: security?.symbol || normalizedSymbol,
    name: security?.name || null,
    found: resolutionStatus === 'mapped',
  };
}

/**
 * Resolve multiple symbols in batch.
 * @param {string[]} rawSymbols - Array of user-provided symbols
 * @param {Object} context - Request context
 * @returns {Promise<Array>} Array of resolution results
 */
export async function resolveSymbols(rawSymbols, context = {}) {
  const results = [];
  
  for (const rawSymbol of rawSymbols) {
    const result = await resolveSymbol(rawSymbol, context);
    results.push(result);
  }
  
  return results;
}

/**
 * Create a new security_master entry.
 * @param {string} symbol - Normalized symbol
 * @returns {Promise<Object>} Created security object
 */
async function createSecurity(symbol) {
  // Insert minimal security entry
  const result = await query(
    `INSERT INTO security_master (
      symbol, fmp_symbol_raw, security_type, active,
      first_seen_date, last_seen_date
    ) VALUES ($1, $2, 'stock', true, CURRENT_DATE, CURRENT_DATE)
    RETURNING *`,
    [symbol, symbol]
  );
  
  const newSecurity = result.rows[0];
  
  // Asynchronously enrich with FMP data (don't wait for it)
  enrichSecurityAsync(newSecurity.id, symbol);
  
  return newSecurity;
}

/**
 * Enrich security with FMP profile data (async, non-blocking).
 * @param {string} securityId - Security UUID
 * @param {string} symbol - Stock symbol
 */
async function enrichSecurityAsync(securityId, symbol) {
  try {
    await fmpService.enrichSecurity(securityId, symbol);
    console.log(`[SymbolResolution] Enriched security: ${symbol}`);
  } catch (error) {
    console.error(`[SymbolResolution] Failed to enrich ${symbol}:`, error.message);
  }
}

/**
 * Get unresolved client requests (for manual review).
 * @param {number} limit - Max number of results
 * @returns {Promise<Array>} Array of unresolved requests
 */
export async function getUnresolvedRequests(limit = 100) {
  const result = await query(
    `SELECT * FROM v_unresolved_requests
     ORDER BY submitted_at DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows;
}

/**
 * Manually resolve a failed request.
 * @param {string} requestId - Client request UUID
 * @param {string} securityId - Resolved security UUID
 * @param {string} notes - Resolution notes
 */
export async function manuallyResolveRequest(requestId, securityId, notes) {
  await query(
    `UPDATE client_requests
     SET security_id = $1,
         resolution_status = 'mapped',
         resolution_notes = $2,
         resolved_at = NOW()
     WHERE id = $3`,
    [securityId, notes, requestId]
  );
}

export default {
  resolveSymbol,
  resolveSymbols,
  getUnresolvedRequests,
  manuallyResolveRequest,
};
