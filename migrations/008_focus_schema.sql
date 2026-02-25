-- Migration 008: Focus (Portfolio Analytics) Schema

-- Performance history
CREATE TABLE IF NOT EXISTS performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  household_id UUID REFERENCES households(id),
  date DATE NOT NULL,
  total_value NUMERIC(15,2),
  cash_value NUMERIC(15,2),
  invested_value NUMERIC(15,2),
  daily_return_pct NUMERIC(7,4),
  ytd_return_pct NUMERIC(7,4),
  inception_return_pct NUMERIC(7,4),
  benchmark_return_pct NUMERIC(7,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_history_account_date ON performance_history(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_history_household_date ON performance_history(household_id, date DESC);

-- Allocation targets
CREATE TABLE IF NOT EXISTS allocation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  asset_class VARCHAR(50) NOT NULL,
  target_percentage NUMERIC(5,4) NOT NULL,
  min_percentage NUMERIC(5,4),
  max_percentage NUMERIC(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, asset_class)
);

-- Tax-loss harvest opportunities
CREATE TABLE IF NOT EXISTS tax_loss_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  lot_id UUID REFERENCES lots(id),
  symbol VARCHAR(20) NOT NULL,
  quantity NUMERIC(15,4),
  cost_basis NUMERIC(15,2),
  current_value NUMERIC(15,2),
  unrealized_loss NUMERIC(15,2),
  estimated_tax_savings NUMERIC(15,2),
  replacement_symbol VARCHAR(20),
  status VARCHAR(50) DEFAULT 'identified',
  wash_sale_violation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  harvested_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tlh_account ON tax_loss_opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_tlh_status ON tax_loss_opportunities(status);

-- Rebalance recommendations
CREATE TABLE IF NOT EXISTS rebalance_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  status VARCHAR(50) DEFAULT 'pending',
  total_drift NUMERIC(7,4),
  tax_impact NUMERIC(15,2),
  trades JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rebalance_household ON rebalance_recommendations(household_id);
CREATE INDEX IF NOT EXISTS idx_rebalance_status ON rebalance_recommendations(status);

COMMENT ON TABLE performance_history IS 'Daily portfolio performance tracking per account and household';
COMMENT ON TABLE allocation_targets IS 'Target asset allocation per household';
COMMENT ON TABLE tax_loss_opportunities IS 'Identified tax-loss harvesting opportunities';
COMMENT ON TABLE rebalance_recommendations IS 'Portfolio rebalancing recommendations with trade lists';
