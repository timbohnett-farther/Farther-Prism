## Prism - Market Data Integration (FMP)

**Provider:** Financial Modeling Prep (FMP)  
**Architecture:** Self-expanding securities universe with daily batch pricing  
**Cost:** $14/month (Standard plan) or free tier for testing

---

## Architecture Overview

Prism uses a **growing universe** pattern:
1. Securities are added to `security_master` **on demand** (when advisors upload portfolios)
2. Every morning at 6 AM ET, **all ever-used securities** are re-priced via FMP batch API
3. Prices stored in `daily_prices` table for fast lookups
4. No intraday API calls except for brand-new symbols (optional enrichment)

**Benefits:**
- Predictable API usage (one batch job per day)
- Fast portfolio valuation (query local DB, not external API)
- Automatic growth (universe expands with real usage)
- No pre-configuration required (no need to know symbols in advance)

---

## Setup

### 1. Get FMP API Key

Sign up at: https://site.financialmodelingprep.com/pricing

**Recommended tier:** Standard ($14/month)
- 750 API calls/day
- Real-time quotes
- Historical data
- Company profiles

**For testing:** Free tier (250 calls/day)

### 2. Set Environment Variable

```bash
# Add to .env
FMP_API_KEY=your_api_key_here
```

### 3. Deploy Database Schema

```bash
cd database
psql $DATABASE_URL < schema/05-market-data.sql
psql $DATABASE_URL < schema/06-job-log.sql
```

Or with Docker:
```bash
docker-compose exec postgres psql -U prism_api -d farther_prism -f /docker-entrypoint-initdb.d/05-market-data.sql
docker-compose exec postgres psql -U prism_api -d farther_prism -f /docker-entrypoint-initdb.d/06-job-log.sql
```

### 4. (Optional) Seed Security Master

Populate with all FMP symbols for better coverage:

```bash
node src/scripts/seed-securities.js
```

Options:
```bash
# Limit to first 1000 symbols (for testing)
node src/scripts/seed-securities.js --limit=1000

# Only US exchanges
node src/scripts/seed-securities.js --exchanges=NASDAQ,NYSE
```

**Note:** This is optional. Prism will automatically add securities as they're encountered in client portfolios.

### 5. Start Scheduler

**Option A: Run as separate process**
```bash
node src/scheduler.js
```

**Option B: Add to package.json scripts**
```json
{
  "scripts": {
    "scheduler": "node src/scheduler.js"
  }
}
```

**Option C: Use PM2 (production)**
```bash
pm2 start src/scheduler.js --name prism-scheduler
pm2 save
```

**Option D: Railway Cron Job**
- Create new service in Railway
- Set start command: `node src/scheduler.js`
- Or use Railway's native cron (coming soon)

---

## How It Works

### Intraday Flow (Client uploads portfolio)

1. **Client uploads CSV** with symbols + quantities
2. **Symbol resolution service** checks each symbol:
   - If exists in `security_master` → use existing, update `last_seen_date`
   - If new → create entry in `security_master`, optionally enrich with FMP profile
3. **Valuation** uses most recent price from `daily_prices` table
4. **Request logged** in `client_requests` table

**API calls:** 0-10 per upload (only for brand new symbols, optional)

### Morning Batch Job (6 AM ET daily)

1. **Query security_master** for all symbols where `last_seen_date IS NOT NULL` and `is_active = true`
2. **Batch symbols** into groups of 200
3. **Call FMP quote API** for each batch: `/api/v3/quote/AAPL,MSFT,GOOGL,...?apikey=xxx`
4. **Upsert prices** into `daily_prices` table
5. **Log job run** in `job_log` table

**API calls:** `CEILING(total_securities / 200)`
- 1,000 securities = 5 API calls
- 10,000 securities = 50 API calls
- 100,000 securities = 500 API calls

**Runtime:** ~5-10 minutes for 10,000 securities

---

## Database Tables

### `security_master` (Extended)
- Stores all securities (stocks, ETFs, funds)
- **Key fields:**
  - `symbol` - Ticker (e.g., "AAPL")
  - `fmp_symbol_raw` - Original FMP symbol
  - `first_seen_date` - When first encountered
  - `last_seen_date` - Most recent use (auto-updated)
  - `is_active` - False if delisted/inactive >6 months

### `daily_prices`
- OHLCV prices for each security per day
- **Key fields:**
  - `security_id` - FK to security_master
  - `price_date` - Trading date
  - `close_price` - Official close
  - `adjusted_close` - Split/dividend adjusted
  - `volume` - Trading volume
  - `source` - Data source (FMP_EOD, FMP_QUOTE)

### `client_requests`
- Tracks all symbol requests from clients
- **Key fields:**
  - `raw_symbol` - Exact string provided by client
  - `security_id` - Resolved security (nullable)
  - `resolution_status` - pending/mapped/failed
  - `household_id` - Which client requested

### `fmp_api_log`
- Audit log for all FMP API calls
- **Key fields:**
  - `endpoint` - API endpoint called
  - `status_code` - HTTP status
  - `response_time_ms` - Latency
  - `symbols_requested` - Batch size
  - `symbols_returned` - Success count

### `job_log`
- Tracks scheduled job executions
- **Key fields:**
  - `job_name` - e.g., "DailyPriceUpdate"
  - `status` - success/failed/running
  - `result_json` - Job results
  - `duration_ms` - Execution time

---

## API Usage Examples

### Get Quote (Single Symbol)
```javascript
import fmpService from './services/fmp-service.js';

const quote = await fmpService.getQuotes('AAPL');
console.log(quote);
// [{
//   symbol: 'AAPL',
//   price: 185.42,
//   change: 2.15,
//   changesPercentage: 1.17,
//   volume: 54238900,
//   ...
// }]
```

### Get Quotes (Batch)
```javascript
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN'];
const quotes = await fmpService.getQuotes(symbols);
```

### Get Company Profile
```javascript
const profile = await fmpService.getProfile('AAPL');
console.log(profile.companyName, profile.sector, profile.industry);
```

### Get Historical Prices
```javascript
const history = await fmpService.getHistoricalPrices('AAPL', '2024-01-01', '2024-12-31');
```

### Resolve Symbol
```javascript
import symbolResolution from './services/symbol-resolution-service.js';

const result = await symbolResolution.resolveSymbol('AAPL', {
  householdId: 'uuid-here',
  requestType: 'portfolio_upload'
});

console.log(result);
// {
//   securityId: 'uuid',
//   symbol: 'AAPL',
//   name: 'Apple Inc.',
//   found: true
// }
```

---

## Monitoring

### Check Job Status
```sql
SELECT * FROM v_recent_jobs ORDER BY started_at DESC LIMIT 10;
```

### Check API Usage
```sql
SELECT 
  endpoint,
  COUNT(*) AS calls,
  AVG(response_time_ms) AS avg_latency,
  SUM(symbols_requested) AS total_symbols
FROM fmp_api_log
WHERE requested_at >= CURRENT_DATE
GROUP BY endpoint
ORDER BY calls DESC;
```

### Check Unresolved Symbols
```sql
SELECT * FROM v_unresolved_requests LIMIT 20;
```

### Check Securities Needing Update
```sql
SELECT * FROM v_securities_needing_update LIMIT 20;
```

---

## Troubleshooting

### Job Not Running
```bash
# Check if scheduler is running
ps aux | grep scheduler

# Check logs
tail -f logs/scheduler.log

# Run job manually
node src/jobs/daily-price-update.js
```

### API Rate Limit Exceeded
- Free tier: 250 calls/day
- Paid tier: 750 calls/day
- Solution: Reduce universe size or upgrade plan

### Symbol Not Found
1. Check `client_requests` table: `SELECT * FROM v_unresolved_requests WHERE raw_symbol = 'XXX'`
2. Manually resolve: `UPDATE client_requests SET security_id = 'uuid', resolution_status = 'mapped' WHERE id = 'request-uuid'`
3. Or add to security_master manually

### Stale Prices
```sql
-- Find securities with old prices
SELECT * FROM v_securities_needing_update WHERE days_since_last_price > 2;
```

---

## Cost Estimation

**Free tier (250 calls/day):**
- Can price ~50,000 securities per day (200 per call × 250)
- Suitable for small firms (<5,000 securities)

**Standard tier ($14/month, 750 calls/day):**
- Can price ~150,000 securities per day
- Suitable for most firms (<50,000 securities)

**Professional tier ($100/month, unlimited):**
- For large firms or high-frequency needs

**Typical usage:**
- 100 households × 10 securities each = 1,000 securities
- Daily batch: 5 API calls
- Monthly cost: Free tier is sufficient

---

## Next Steps

1. **Set FMP_API_KEY** in environment
2. **Deploy schema** (05-market-data.sql, 06-job-log.sql)
3. **Optionally seed** with `node src/scripts/seed-securities.js`
4. **Start scheduler** with `node src/scheduler.js`
5. **Test upload** a portfolio CSV and verify symbols resolve
6. **Monitor** job_log and fmp_api_log tables

---

## Support

**FMP Documentation:** https://site.financialmodelingprep.com/developer/docs  
**Prism Issues:** https://github.com/Ledger-AI-Team/Prism/issues  
**Email:** Ledger@The-AI-Team.io
