# FartherData - Data Lake Documentation

**Status:** ✅ Populated with synthetic market data  
**Last Updated:** February 24, 2026  
**Storage:** Backblaze B2 (FartherData bucket)

---

## Overview

The FartherData lake contains historical market data, correlations, and capital market assumptions needed for Prism financial planning calculations.

**Current Data Type:** Synthetic (statistically realistic)  
**Future Migration:** Will be replaced with Bloomberg/Refinitiv data feeds

---

## Data Structure

```
FartherData/
│
├── market-data/
│   ├── daily-prices/              # Daily OHLCV for 8 asset classes
│   │   ├── SPY.csv                # S&P 500 (2000-2026, 6,822 days)
│   │   ├── IWM.csv                # Russell 2000
│   │   ├── EFA.csv                # MSCI EAFE
│   │   ├── EEM.csv                # Emerging Markets
│   │   ├── AGG.csv                # US Aggregate Bond
│   │   ├── TLT.csv                # Long-Term Treasury
│   │   ├── VNQ.csv                # US Real Estate
│   │   ├── GLD.csv                # Gold
│   │   └── *-metadata.json        # Metadata for each asset
│   │
│   └── correlations/
│       └── asset-class-correlations.json  # Correlation matrix
│
├── cma/
│   └── 2026-Q1-expected-returns.json      # Capital Market Assumptions
│
└── metadata/
    └── data-dictionary.json               # Data catalog
```

---

## Asset Classes Covered

| Symbol | Name | Asset Class | Annual Return | Volatility |
|--------|------|-------------|---------------|------------|
| SPY | S&P 500 | US Large Cap Equity | 10% | 18% |
| IWM | Russell 2000 | US Small Cap Equity | 11% | 22% |
| EFA | MSCI EAFE | International Developed | 8% | 20% |
| EEM | MSCI Emerging Markets | Emerging Markets | 9% | 25% |
| AGG | US Aggregate Bond | US Bonds | 4% | 5% |
| TLT | Long-Term Treasury | Long-Term Bonds | 5% | 12% |
| VNQ | US Real Estate | Real Estate | 9% | 20% |
| GLD | Gold | Commodities | 6% | 16% |

---

## Data Quality

**Generation Method:** Geometric Brownian Motion with realistic parameters
- Daily returns: Normally distributed around historical means
- Volatility: Matches historical standard deviations
- Correlations: Based on actual market relationships

**Suitable For:**
- ✅ Monte Carlo simulations
- ✅ Portfolio optimization
- ✅ Risk assessment
- ✅ Prototype development
- ✅ Advisor training/demos

**NOT Suitable For:**
- ❌ Live client portfolios (until migrated to real data)
- ❌ Regulatory filings
- ❌ Performance attribution (real holdings need real prices)

---

## Access Credentials

**Stored in:** `.env.backblaze` (gitignored)

```bash
BACKBLAZE_KEY_ID=004a5a99ffb6f1d0000000001
BACKBLAZE_APPLICATION_KEY=K004BrJ4F6n7ygogTi2yEcu3asfHMMw
BACKBLAZE_BUCKET_NAME=FartherData
BACKBLAZE_ENDPOINT=s3.us-west-004.backblazeb2.com
```

---

## Usage Examples

### Read Price Data (Node.js)

```javascript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: 'https://s3.us-west-004.backblazeb2.com',
  region: 'us-west-004',
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID,
    secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY
  },
  forcePathStyle: true
});

// Fetch SPY prices
const command = new GetObjectCommand({
  Bucket: 'FartherData',
  Key: 'market-data/daily-prices/SPY.csv'
});

const response = await s3.send(command);
const csv = await response.Body.transformToString();
```

### Read Correlations

```javascript
const corrCommand = new GetObjectCommand({
  Bucket: 'FartherData',
  Key: 'market-data/correlations/asset-class-correlations.json'
});

const corrResponse = await s3.send(corrCommand);
const correlations = JSON.parse(await corrResponse.Body.transformToString());

// Access correlation between SPY and AGG
const spyAggCorr = correlations.matrix.SPY.AGG; // -0.10
```

---

## Next Steps

### Phase 1: Integration (This Week)
- [ ] Build data reader module for Prism
- [ ] Connect Monte Carlo engine to market data
- [ ] Use correlations for multi-asset simulations

### Phase 2: Enhancement (Week 2-3)
- [ ] Add economic data (inflation, rates, GDP)
- [ ] Add tax tables (federal brackets, IRMAA, RMD)
- [ ] Build statement archive structure

### Phase 3: Production (Later)
- [ ] Migrate to Bloomberg/Refinitiv data feeds
- [ ] Daily automated updates
- [ ] Data quality monitoring

---

## Storage Costs

**Current Usage:** ~4 MB (19 files)  
**Backblaze B2 Pricing:**
- Storage: $6/TB/month = **$0.00002/month** (negligible)
- Download: $0.01/GB (only when Prism reads data)
- Estimated monthly cost: **< $0.01**

**Projected at Scale:**
- With 10 years daily data for 100+ tickers: ~500 MB
- With client statement archives (10,000 clients): ~5 GB
- Monthly cost: **~$0.05** (still negligible)

---

## Maintenance

**Current:** No maintenance required (static synthetic data)

**Future (Real Data):**
- Daily ingestion scripts (run after market close)
- Data quality checks (missing days, outliers)
- Versioning (keep historical data for backtesting)

---

## Migration Path

**When Bloomberg/Refinitiv is ready:**

1. Keep synthetic data in `market-data/synthetic/` (for testing)
2. Add real data to `market-data/live/`
3. Update Prism to read from `live/` instead of `daily-prices/`
4. Run parallel validation for 1 month
5. Archive synthetic data

---

## Support

**Data Issues:** Check `metadata/data-dictionary.json` for schema  
**Access Issues:** Verify `.env.backblaze` credentials  
**Questions:** Contact ledger@the-ai-team.io
