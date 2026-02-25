-- Migration 011: Beyond (Alternative Investments) Schema

CREATE TABLE IF NOT EXISTS alternative_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- private_equity, hedge_fund, real_estate, venture_capital, credit, infrastructure, commodities
  subcategory VARCHAR(100),
  manager VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, closed, liquidating
  
  -- Key metrics
  minimum_investment NUMERIC(15,2),
  target_return NUMERIC(7,4),
  target_yield NUMERIC(7,4),
  management_fee NUMERIC(5,4),
  performance_fee NUMERIC(5,4), -- carried interest
  lockup_months INTEGER,
  
  -- Due diligence
  due_diligence_score NUMERIC(5,2), -- 0-100
  risk_rating VARCHAR(20), -- low, moderate, high, very_high
  liquidity VARCHAR(20), -- daily, monthly, quarterly, annual, illiquid
  
  -- Description
  strategy TEXT,
  highlights JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alts_category ON alternative_investments(category);
CREATE INDEX IF NOT EXISTS idx_alts_status ON alternative_investments(status);

CREATE TABLE IF NOT EXISTS alt_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  investment_id UUID REFERENCES alternative_investments(id),
  amount NUMERIC(15,2),
  commitment_date DATE,
  status VARCHAR(50) DEFAULT 'committed', -- committed, funded, distributed, liquidated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alt_alloc_household ON alt_allocations(household_id);

-- Seed sample alternative investments
INSERT INTO alternative_investments (name, category, subcategory, manager, minimum_investment, target_return, target_yield, management_fee, performance_fee, lockup_months, due_diligence_score, risk_rating, liquidity, strategy, highlights, risks) VALUES
(
  'Farther Private Equity Fund I',
  'private_equity',
  'buyout',
  'Farther Asset Management',
  250000,
  0.15,
  0,
  0.02,
  0.20,
  84,
  92,
  'high',
  'illiquid',
  'Diversified buyout fund targeting middle-market companies with strong cash flows and operational improvement potential.',
  '["Target 15% net IRR","Diversified across 15-20 companies","Experienced operating partners","Focus on value creation"]'::jsonb,
  '["Illiquid - 7 year lockup","Capital calls over 3-5 years","J-curve effect in early years","Concentration risk"]'::jsonb
),
(
  'Farther Real Estate Income Fund',
  'real_estate',
  'core_plus',
  'Farther Asset Management',
  100000,
  0.10,
  0.06,
  0.015,
  0.15,
  36,
  88,
  'moderate',
  'quarterly',
  'Core-plus real estate fund focused on multifamily and industrial properties in high-growth Sun Belt markets.',
  '["6% target yield","Quarterly liquidity windows","Tax-advantaged distributions","Inflation hedge"]'::jsonb,
  '["Real estate market cycles","Interest rate sensitivity","Tenant concentration","Geographic concentration"]'::jsonb
),
(
  'Farther Credit Opportunities Fund',
  'credit',
  'direct_lending',
  'Farther Asset Management',
  100000,
  0.09,
  0.08,
  0.015,
  0.15,
  24,
  85,
  'moderate',
  'quarterly',
  'Direct lending fund providing senior secured loans to middle-market companies with strong collateral.',
  '["8% target current yield","Senior secured position","Floating rate (inflation protection)","Quarterly distributions"]'::jsonb,
  '["Credit risk","Illiquidity premium","Interest rate environment","Economic cycle sensitivity"]'::jsonb
),
(
  'Farther Venture Capital Fund I',
  'venture_capital',
  'growth_equity',
  'Farther Asset Management',
  500000,
  0.25,
  0,
  0.025,
  0.20,
  120,
  78,
  'very_high',
  'illiquid',
  'Growth-stage venture fund targeting fintech, healthcare AI, and climate tech companies.',
  '["Target 25% net IRR","Access to pre-IPO companies","Portfolio of 20-30 companies","Follow-on reserves"]'::jsonb,
  '["Very high risk","10 year lockup","Most returns from few winners","J-curve effect"]'::jsonb
),
(
  'Farther Hedge Fund Solutions',
  'hedge_fund',
  'multi_strategy',
  'Farther Asset Management',
  500000,
  0.08,
  0,
  0.015,
  0.15,
  12,
  82,
  'moderate',
  'monthly',
  'Multi-strategy hedge fund combining long/short equity, global macro, and event-driven strategies for uncorrelated returns.',
  '["Low correlation to stocks/bonds","Monthly liquidity","Downside protection","Diversified strategies"]'::jsonb,
  '["Complex strategies","Manager selection risk","Fee drag","Potential for negative returns"]'::jsonb
);

COMMENT ON TABLE alternative_investments IS 'Alternative investment opportunities (PE, RE, VC, hedge funds, credit)';
COMMENT ON TABLE alt_allocations IS 'Client allocations to alternative investments';
