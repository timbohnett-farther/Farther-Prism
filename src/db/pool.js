/**
 * Farther Prism - Database Connection Pool
 * 
 * Uses pg (node-postgres) with connection pooling.
 * Automatically configures from DATABASE_URL or individual env vars.
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual vars
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'farther_prism',
  user: process.env.DB_USER || 'prism_api',
  password: process.env.DB_PASSWORD || 'changeme',
  
  // Pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  
  // SSL for production
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : undefined,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Log connection events in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    console.log('[DB] New client connected');
  });
}

/**
 * Execute a query with automatic client acquisition/release.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
  }
  
  return result;
}

/**
 * Get a client for transactions.
 * IMPORTANT: Always release the client in a finally block.
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  const client = await pool.getClient();
  return client;
}

/**
 * Execute a function within a transaction.
 * Automatically commits on success, rolls back on error.
 * @param {Function} fn - Async function receiving (client)
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check - verify database connectivity.
 * @returns {Promise<{ok: boolean, latency: number}>}
 */
export async function healthCheck() {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

export default pool;
