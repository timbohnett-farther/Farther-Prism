-- ============================================================================
-- FARTHER PRISM - Market Data Extension
-- FMP (Financial Modeling Prep) Integration
-- 
-- Version: 1.0.0
-- Date: 2026-02-23
-- 
-- Implements self-expanding securities universe with daily batch pricing.
-- ============================================================================

-- ============================================================================
-- EXTEND SECURITY_MASTER
-- ============================================================================

-- Add FMP-specific fields to existing security_master table
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS fmp_symbol_raw VARCHAR(20);
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS first_seen_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS last_seen_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS market_cap BIGINT;
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS country VARCHAR(50);
ALTER TABLE security_master ADD COLUMN IF NOT EXISTS ipo_date DATE;

-- Add indexes for FMP queries
CREATE INDEX IF NOT EXISTS idx_security_master_last_seen ON security_master(last_seen_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_security_master_fmp_symbol ON security_master(fmp_symbol_raw);

COMMENT ON COLUMN security_master.fmp_symbol_raw IS 'Original symbol passed to FMP API (may differ from display symbol)';
COMMENT ON COLUMN security_master.first_seen_date IS 'First time this security appeared in any client request';
COMMENT ON COLUMN security_master.last_seen_date IS 'Most recent time this security was used (updates on every client request)';
COMMENT ON COLUMN security_master.is_active IS 'False if delisted or inactive for >6 months';

-- ============================================================================
-- DAILY_PRICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    security_id UUID NOT NULL REFERENCES security_master(id) ON DELETE CASCADE,
    
    -- Date
    price_date DATE NOT NULL,
    
    -- OHLCV
    open_price NUMERIC(20,4),
    high_price NUMERIC(20,4),
    low_price NUMERIC(20,4),
    close_price NUMERIC(20,4) NOT NULL,
    volume BIGINT,
    
    -- Adjusted prices (for splits/dividends)
    adjusted_close NUMERIC(20,4),
    
    -- Derived metrics
    change_amount NUMERIC(20,4),
    change_percent NUMERIC(10,6),
    
    -- Source tracking
    source VARCHAR(50) DEFAULT 'FMP_EOD',
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT daily_prices_positive_prices CHECK (
        open_price IS NULL OR open_price >= 0
    ),
    CONSTRAINT daily_prices_close_positive CHECK (close_price > 0),
    
    -- Unique constraint (one price per security per day)
    CONSTRAINT daily_prices_unique_security_date UNIQUE (security_id, price_date)
);

-- Indexes for fast queries
CREATE INDEX idx_daily_prices_security ON daily_prices(security_id);
CREATE INDEX idx_daily_prices_date ON daily_prices(price_date DESC);
CREATE INDEX idx_daily_prices_security_date ON daily_prices(security_id, price_date DESC);
CREATE INDEX idx_daily_prices_fetched ON daily_prices(fetched_at DESC);

COMMENT ON TABLE daily_prices IS 'Historical daily OHLCV prices from FMP (updated via morning batch job)';
COMMENT ON COLUMN daily_prices.source IS 'Data source (FMP_EOD, FMP_QUOTE, FMP_HISTORICAL, etc.)';
COMMENT ON COLUMN daily_prices.adjusted_close IS 'Split/dividend adjusted close price';

-- ============================================================================
-- CLIENT_REQUESTS TABLE (Track symbol usage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request context
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL, -- 'portfolio_upload', 'planning_run', 'position_create'
    
    -- Symbol tracking
    raw_symbol VARCHAR(20) NOT NULL,
    security_id UUID REFERENCES security_master(id) ON DELETE SET NULL,
    
    -- Resolution status
    resolution_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'mapped', 'failed', 'manual_review'
    resolution_notes TEXT,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT client_requests_status_check CHECK (
        resolution_status IN ('pending', 'mapped', 'failed', 'manual_review')
    )
);

CREATE INDEX idx_client_requests_household ON client_requests(household_id);
CREATE INDEX idx_client_requests_raw_symbol ON client_requests(raw_symbol);
CREATE INDEX idx_client_requests_security ON client_requests(security_id);
CREATE INDEX idx_client_requests_status ON client_requests(resolution_status);
CREATE INDEX idx_client_requests_submitted ON client_requests(submitted_at DESC);

COMMENT ON TABLE client_requests IS 'Tracks all symbol requests from clients (grows security universe organically)';
COMMENT ON COLUMN client_requests.raw_symbol IS 'Exact symbol string provided by client/advisor';
COMMENT ON COLUMN client_requests.resolution_status IS 'Whether symbol was successfully mapped to security_master';

-- ============================================================================
-- FMP_API_LOG (Track API usage and errors)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fmp_api_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request details
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    request_params JSONB,
    
    -- Response
    status_code INTEGER,
    response_time_ms INTEGER,
    symbols_requested INTEGER,
    symbols_returned INTEGER,
    
    -- Error tracking
    error_message TEXT,
    
    -- Timestamps
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fmp_api_log_endpoint ON fmp_api_log(endpoint);
CREATE INDEX idx_fmp_api_log_requested ON fmp_api_log(requested_at DESC);
CREATE INDEX idx_fmp_api_log_status ON fmp_api_log(status_code);

COMMENT ON TABLE fmp_api_log IS 'Audit log for all FMP API calls (rate limiting, debugging, cost tracking)';

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Latest price for each security
CREATE OR REPLACE VIEW v_latest_prices AS
SELECT 
    sm.id AS security_id,
    sm.symbol,
    sm.name,
    sm.asset_class,
    dp.price_date,
    dp.close_price,
    dp.change_amount,
    dp.change_percent,
    dp.volume,
    dp.fetched_at
FROM security_master sm
JOIN LATERAL (
    SELECT *
    FROM daily_prices
    WHERE security_id = sm.id
    ORDER BY price_date DESC
    LIMIT 1
) dp ON true
WHERE sm.active = true;

COMMENT ON VIEW v_latest_prices IS 'Most recent price for each active security';

-- Securities needing price updates (stale or missing)
CREATE OR REPLACE VIEW v_securities_needing_update AS
SELECT 
    sm.id,
    sm.symbol,
    sm.fmp_symbol_raw,
    sm.last_seen_date,
    MAX(dp.price_date) AS last_price_date,
    CURRENT_DATE - MAX(dp.price_date) AS days_since_last_price
FROM security_master sm
LEFT JOIN daily_prices dp ON sm.id = dp.security_id
WHERE sm.is_active = true
    AND sm.last_seen_date IS NOT NULL
GROUP BY sm.id, sm.symbol, sm.fmp_symbol_raw, sm.last_seen_date
HAVING MAX(dp.price_date) IS NULL 
    OR MAX(dp.price_date) < CURRENT_DATE
ORDER BY days_since_last_price DESC NULLS FIRST;

COMMENT ON VIEW v_securities_needing_update IS 'Securities that need price updates (for morning batch job)';

-- Unresolved client requests (manual review queue)
CREATE OR REPLACE VIEW v_unresolved_requests AS
SELECT 
    cr.id,
    cr.household_id,
    cr.raw_symbol,
    cr.request_type,
    cr.resolution_status,
    cr.submitted_at,
    h.name AS household_name
FROM client_requests cr
LEFT JOIN households h ON cr.household_id = h.id
WHERE cr.resolution_status IN ('pending', 'failed', 'manual_review')
ORDER BY cr.submitted_at DESC;

COMMENT ON VIEW v_unresolved_requests IS 'Client symbol requests that need manual review';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get current price for a security
CREATE OR REPLACE FUNCTION get_current_price(security_id_param UUID)
RETURNS NUMERIC AS $$
DECLARE
    current_price NUMERIC;
BEGIN
    SELECT close_price INTO current_price
    FROM daily_prices
    WHERE security_id = security_id_param
    ORDER BY price_date DESC
    LIMIT 1;
    
    RETURN current_price;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_price(UUID) IS 'Get most recent close price for a security';

-- Function: Update last_seen_date when security is used
CREATE OR REPLACE FUNCTION update_security_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE security_master
    SET last_seen_date = CURRENT_DATE
    WHERE id = NEW.security_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update last_seen_date on position creation
CREATE TRIGGER trigger_update_security_last_seen
    AFTER INSERT OR UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_security_last_seen();

COMMENT ON TRIGGER trigger_update_security_last_seen ON positions IS 'Automatically update security.last_seen_date when position is created/updated';

-- ============================================================================
-- SEED DATA (Optional: Common securities for testing)
-- ============================================================================

-- Insert common ETFs/stocks if not exists
INSERT INTO security_master (symbol, name, security_type, asset_class, fmp_symbol_raw, is_active)
VALUES 
    ('SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'us_equity_large', 'SPY', true),
    ('QQQ', 'Invesco QQQ Trust', 'etf', 'us_equity_large', 'QQQ', true),
    ('IWM', 'iShares Russell 2000 ETF', 'etf', 'us_equity_small', 'IWM', true),
    ('EFA', 'iShares MSCI EAFE ETF', 'etf', 'intl_equity_developed', 'EFA', true),
    ('EEM', 'iShares MSCI Emerging Markets ETF', 'etf', 'intl_equity_emerging', 'EEM', true),
    ('AGG', 'iShares Core U.S. Aggregate Bond ETF', 'etf', 'fixed_income_core', 'AGG', true),
    ('VNQ', 'Vanguard Real Estate ETF', 'etf', 'real_estate', 'VNQ', true)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- COMPLETE
-- ============================================================================

SELECT 'Market data schema deployed successfully.' AS status;
