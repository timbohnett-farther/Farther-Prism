-- Farther Prism - Initial Schema Migration
-- Institutional-grade household-first planning platform
-- Version: 1.0
-- Date: 2026-02-24

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HOUSEHOLDS
-- ============================================================================

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_name VARCHAR(255) NOT NULL,
  primary_advisor_id UUID, -- FK to users table (future)
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, archived
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_households_advisor ON households(primary_advisor_id);
CREATE INDEX idx_households_status ON households(status);

-- ============================================================================
-- PEOPLE (household members, beneficiaries, dependents)
-- ============================================================================

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  relationship VARCHAR(50), -- primary, spouse, child, dependent, beneficiary
  ssn_encrypted TEXT, -- encrypted SSN
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  life_expectancy_override INT, -- manual override (otherwise calculated)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_people_household ON people(household_id);
CREATE INDEX idx_people_primary ON people(household_id, is_primary);

-- ============================================================================
-- ENTITIES (trusts, LLCs, foundations, etc.)
-- ============================================================================

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  entity_name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100), -- revocable_trust, irrevocable_trust, llc, foundation, etc.
  ein_encrypted TEXT, -- encrypted EIN
  formation_date DATE,
  grantor_id UUID REFERENCES people(id), -- if trust
  trustee_id UUID REFERENCES people(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_entities_household ON entities(household_id);
CREATE INDEX idx_entities_type ON entities(entity_type);

-- ============================================================================
-- ACCOUNTS
-- ============================================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_number_encrypted TEXT,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(100) NOT NULL, -- ira_traditional, ira_roth, 401k, taxable, hsa, 529, trust, etc.
  tax_treatment VARCHAR(50) NOT NULL, -- tax_deferred, tax_free, taxable
  custodian VARCHAR(255),
  owner_person_id UUID REFERENCES people(id),
  owner_entity_id UUID REFERENCES entities(id),
  current_value NUMERIC(15,2) DEFAULT 0,
  as_of_date DATE,
  is_managed BOOLEAN DEFAULT FALSE, -- managed by advisor vs. held-away
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT account_owner_check CHECK (
    (owner_person_id IS NOT NULL AND owner_entity_id IS NULL) OR
    (owner_person_id IS NULL AND owner_entity_id IS NOT NULL)
  )
);

CREATE INDEX idx_accounts_household ON accounts(household_id);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_owner_person ON accounts(owner_person_id);
CREATE INDEX idx_accounts_owner_entity ON accounts(owner_entity_id);

-- ============================================================================
-- LOTS (tax lots for holdings)
-- ============================================================================

CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  asset_class VARCHAR(100), -- us_equity, intl_equity, bonds, real_estate, cash, alternatives
  quantity NUMERIC(15,6) NOT NULL,
  cost_basis NUMERIC(15,2),
  acquisition_date DATE,
  current_price NUMERIC(15,4),
  market_value NUMERIC(15,2),
  unrealized_gain_loss NUMERIC(15,2) GENERATED ALWAYS AS (market_value - cost_basis) STORED,
  as_of_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_lots_account ON lots(account_id);
CREATE INDEX idx_lots_symbol ON lots(symbol);
CREATE INDEX idx_lots_asset_class ON lots(asset_class);

-- ============================================================================
-- GOALS
-- ============================================================================

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  goal_name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(100) NOT NULL, -- retirement, college, legacy, major_purchase, etc.
  priority INT DEFAULT 1, -- 1 = essential, 2 = important, 3 = aspirational
  target_amount NUMERIC(15,2),
  target_date DATE,
  person_id UUID REFERENCES people(id), -- who is this goal for?
  funding_status VARCHAR(50) DEFAULT 'not_started', -- not_started, on_track, at_risk, funded
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_goals_household ON goals(household_id);
CREATE INDEX idx_goals_type ON goals(goal_type);
CREATE INDEX idx_goals_priority ON goals(priority);

-- ============================================================================
-- SCENARIOS (versioned planning runs)
-- ============================================================================

CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  scenario_name VARCHAR(255) NOT NULL,
  scenario_type VARCHAR(50) DEFAULT 'base', -- base, optimistic, pessimistic, custom
  is_baseline BOOLEAN DEFAULT FALSE, -- only one baseline per household
  created_by_user_id UUID, -- FK to users (future)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  run_at TIMESTAMPTZ,
  assumptions JSONB DEFAULT '{}'::jsonb, -- inflation, returns, tax rates, life expectancy, etc.
  results_summary JSONB DEFAULT '{}'::jsonb, -- success_rate, ending_wealth, shortfall_years, etc.
  status VARCHAR(50) DEFAULT 'draft', -- draft, running, completed, archived
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_scenarios_household ON scenarios(household_id);
CREATE INDEX idx_scenarios_baseline ON scenarios(household_id, is_baseline);
CREATE INDEX idx_scenarios_status ON scenarios(status);

-- ============================================================================
-- PLANNING GRAPH (monthly projection steps)
-- ============================================================================

CREATE TABLE planning_graph (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  step_date DATE NOT NULL, -- first of month
  step_number INT NOT NULL, -- 0, 1, 2, ... (0 = current state)
  age_primary INT, -- age of primary person
  age_spouse INT, -- age of spouse (if applicable)
  
  -- Cash flows
  income_earned NUMERIC(15,2) DEFAULT 0,
  income_social_security NUMERIC(15,2) DEFAULT 0,
  income_pension NUMERIC(15,2) DEFAULT 0,
  income_other NUMERIC(15,2) DEFAULT 0,
  expenses_living NUMERIC(15,2) DEFAULT 0,
  expenses_healthcare NUMERIC(15,2) DEFAULT 0,
  expenses_discretionary NUMERIC(15,2) DEFAULT 0,
  taxes_federal NUMERIC(15,2) DEFAULT 0,
  taxes_state NUMERIC(15,2) DEFAULT 0,
  taxes_fica NUMERIC(15,2) DEFAULT 0,
  
  -- Account balances (end of month)
  balance_taxable NUMERIC(15,2) DEFAULT 0,
  balance_tax_deferred NUMERIC(15,2) DEFAULT 0,
  balance_tax_free NUMERIC(15,2) DEFAULT 0,
  balance_total NUMERIC(15,2) GENERATED ALWAYS AS (
    balance_taxable + balance_tax_deferred + balance_tax_free
  ) STORED,
  
  -- Withdrawals/contributions
  withdrawal_taxable NUMERIC(15,2) DEFAULT 0,
  withdrawal_tax_deferred NUMERIC(15,2) DEFAULT 0,
  withdrawal_tax_free NUMERIC(15,2) DEFAULT 0,
  contribution_401k NUMERIC(15,2) DEFAULT 0,
  contribution_ira NUMERIC(15,2) DEFAULT 0,
  contribution_roth NUMERIC(15,2) DEFAULT 0,
  
  -- RMDs
  rmd_required NUMERIC(15,2) DEFAULT 0,
  rmd_taken NUMERIC(15,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_planning_graph_scenario ON planning_graph(scenario_id);
CREATE INDEX idx_planning_graph_date ON planning_graph(scenario_id, step_date);
CREATE UNIQUE INDEX idx_planning_graph_unique ON planning_graph(scenario_id, step_number);

-- ============================================================================
-- MONTE CARLO RESULTS (simulation outputs)
-- ============================================================================

CREATE TABLE monte_carlo_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  num_simulations INT NOT NULL,
  success_rate NUMERIC(5,2), -- percentage (0-100)
  median_ending_wealth NUMERIC(15,2),
  percentile_10_wealth NUMERIC(15,2),
  percentile_90_wealth NUMERIC(15,2),
  first_failure_year INT, -- median year of first depletion (if any)
  max_shortfall NUMERIC(15,2), -- worst-case shortfall
  run_duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paths JSONB DEFAULT '[]'::jsonb -- sample paths for visualization
);

CREATE INDEX idx_monte_carlo_scenario ON monte_carlo_results(scenario_id);

-- ============================================================================
-- AUDIT LOG (compliance trail)
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  user_id UUID, -- FK to users (future)
  action VARCHAR(100) NOT NULL, -- create, update, delete, run_scenario, approve, etc.
  entity_type VARCHAR(100), -- household, account, scenario, etc.
  entity_id UUID,
  changes JSONB, -- before/after snapshot
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_household ON audit_log(household_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- TRIGGERS (auto-update timestamps)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER people_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER entities_updated_at BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER lots_updated_at BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA / LOOKUPS
-- ============================================================================

-- Account type reference (for validation)
CREATE TABLE account_types_ref (
  code VARCHAR(100) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  tax_treatment VARCHAR(50) NOT NULL,
  description TEXT,
  contribution_limit_2026 NUMERIC(10,2),
  catch_up_limit_2026 NUMERIC(10,2)
);

INSERT INTO account_types_ref (code, display_name, tax_treatment, description, contribution_limit_2026, catch_up_limit_2026) VALUES
  ('ira_traditional', 'Traditional IRA', 'tax_deferred', 'Tax-deferred individual retirement account', 7000, 1000),
  ('ira_roth', 'Roth IRA', 'tax_free', 'Tax-free individual retirement account', 7000, 1000),
  ('401k', '401(k)', 'tax_deferred', 'Employer-sponsored retirement plan', 23500, 7500),
  ('roth_401k', 'Roth 401(k)', 'tax_free', 'Roth employer-sponsored retirement plan', 23500, 7500),
  ('403b', '403(b)', 'tax_deferred', 'Non-profit/education retirement plan', 23500, 7500),
  ('sep_ira', 'SEP IRA', 'tax_deferred', 'Simplified Employee Pension IRA', 69000, 0),
  ('simple_ira', 'SIMPLE IRA', 'tax_deferred', 'Savings Incentive Match Plan', 16000, 3500),
  ('hsa', 'Health Savings Account', 'tax_free', 'Triple tax-advantaged health account', 4150, 1000),
  ('529', '529 College Savings', 'tax_free', 'Education savings plan', NULL, NULL),
  ('taxable_individual', 'Individual Brokerage', 'taxable', 'Taxable brokerage account', NULL, NULL),
  ('taxable_joint', 'Joint Brokerage', 'taxable', 'Joint taxable brokerage', NULL, NULL),
  ('trust', 'Trust Account', 'taxable', 'Trust-owned account (varies)', NULL, NULL),
  ('pension', 'Pension', 'tax_deferred', 'Defined benefit pension', NULL, NULL),
  ('annuity', 'Annuity', 'tax_deferred', 'Tax-deferred annuity', NULL, NULL);

-- ============================================================================
-- VIEWS (convenience queries)
-- ============================================================================

-- Household summary view
CREATE VIEW household_summary AS
SELECT 
  h.id,
  h.household_name,
  h.status,
  COUNT(DISTINCT p.id) AS num_people,
  COUNT(DISTINCT a.id) AS num_accounts,
  SUM(a.current_value) AS total_aum,
  MAX(a.as_of_date) AS latest_data_date
FROM households h
LEFT JOIN people p ON h.id = p.household_id
LEFT JOIN accounts a ON h.id = a.household_id
GROUP BY h.id, h.household_name, h.status;

COMMENT ON TABLE households IS 'Top-level household container - all data belongs to a household';
COMMENT ON TABLE people IS 'Individuals in household (clients, spouses, dependents, beneficiaries)';
COMMENT ON TABLE accounts IS 'Financial accounts (IRAs, 401ks, taxable, trusts, etc.)';
COMMENT ON TABLE lots IS 'Individual tax lots with cost basis tracking';
COMMENT ON TABLE scenarios IS 'Versioned planning scenarios with assumptions and results';
COMMENT ON TABLE planning_graph IS 'Monthly projection steps for cash flow and balance evolution';
COMMENT ON TABLE audit_log IS 'Compliance trail for all system changes';
