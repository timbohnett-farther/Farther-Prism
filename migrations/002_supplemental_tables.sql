-- Supplemental Tables Migration
-- Adds tables needed by existing prototype code that weren't in the core institutional schema
-- Version: 1.1
-- Date: 2026-02-24

-- ============================================================================
-- RELATIONSHIPS (person-to-person links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- spouse, child, parent, dependent, beneficiary
  dependent BOOLEAN DEFAULT FALSE,
  support_percentage NUMERIC(5,2), -- % of support provided (for dependency)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_people CHECK (person_id != related_person_id)
);

CREATE INDEX idx_relationships_household ON relationships(household_id);
CREATE INDEX idx_relationships_person ON relationships(person_id);
CREATE INDEX idx_relationships_related ON relationships(related_person_id);

-- ============================================================================
-- EXPENSE CATEGORIES (lookup table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name VARCHAR(100) NOT NULL UNIQUE,
  category_group VARCHAR(50), -- housing, transportation, healthcare, etc.
  is_essential BOOLEAN DEFAULT TRUE,
  display_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common expense categories
INSERT INTO expense_categories (category_name, category_group, is_essential, display_order) VALUES
  ('Housing (Rent/Mortgage)', 'housing', TRUE, 1),
  ('Property Tax', 'housing', TRUE, 2),
  ('HOA Fees', 'housing', TRUE, 3),
  ('Home Insurance', 'housing', TRUE, 4),
  ('Utilities', 'housing', TRUE, 5),
  ('Home Maintenance', 'housing', TRUE, 6),
  ('Auto Loan/Lease', 'transportation', TRUE, 10),
  ('Auto Insurance', 'transportation', TRUE, 11),
  ('Gas & Maintenance', 'transportation', TRUE, 12),
  ('Public Transit', 'transportation', FALSE, 13),
  ('Healthcare Premiums', 'healthcare', TRUE, 20),
  ('Out-of-Pocket Medical', 'healthcare', TRUE, 21),
  ('Prescriptions', 'healthcare', TRUE, 22),
  ('Dental/Vision', 'healthcare', TRUE, 23),
  ('Groceries', 'living', TRUE, 30),
  ('Dining Out', 'living', FALSE, 31),
  ('Clothing', 'living', TRUE, 32),
  ('Personal Care', 'living', TRUE, 33),
  ('Childcare', 'family', TRUE, 40),
  ('Education', 'family', TRUE, 41),
  ('Entertainment', 'discretionary', FALSE, 50),
  ('Travel & Vacation', 'discretionary', FALSE, 51),
  ('Hobbies', 'discretionary', FALSE, 52),
  ('Charitable Giving', 'discretionary', FALSE, 53),
  ('Other', 'other', FALSE, 99)
ON CONFLICT (category_name) DO NOTHING;

-- ============================================================================
-- INCOME STREAMS (recurring income sources)
-- ============================================================================

CREATE TABLE IF NOT EXISTS income_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id), -- who earns this income
  entity_id UUID REFERENCES entities(id), -- OR which entity earns it
  income_type VARCHAR(50) NOT NULL, -- salary, bonus, pension, social_security, rental, business, investment
  description VARCHAR(255),
  base_amount NUMERIC(12,2) NOT NULL, -- base annual amount (or per-period amount)
  amount_frequency VARCHAR(20) DEFAULT 'annual', -- annual, monthly, biweekly, etc.
  growth_rate NUMERIC(5,4) DEFAULT 0, -- annual growth rate (e.g., 0.03 = 3%)
  inflation_indexed BOOLEAN DEFAULT FALSE, -- auto-adjusts with inflation
  tax_character VARCHAR(50) DEFAULT 'ordinary', -- ordinary, capital_gains, qualified_dividends, tax_free
  start_date DATE,
  end_date DATE, -- NULL = indefinite
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT income_owner_check CHECK (
    (person_id IS NOT NULL AND entity_id IS NULL) OR
    (person_id IS NULL AND entity_id IS NOT NULL) OR
    (person_id IS NULL AND entity_id IS NULL)
  )
);

CREATE INDEX idx_income_streams_household ON income_streams(household_id);
CREATE INDEX idx_income_streams_person ON income_streams(person_id);
CREATE INDEX idx_income_streams_type ON income_streams(income_type);
CREATE INDEX idx_income_streams_active ON income_streams(household_id, active);

-- ============================================================================
-- EXPENSE STREAMS (recurring expenses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  expense_category_id UUID REFERENCES expense_categories(id),
  description VARCHAR(255),
  base_amount NUMERIC(12,2) NOT NULL, -- base annual amount (or per-period)
  amount_frequency VARCHAR(20) DEFAULT 'annual', -- annual, monthly, etc.
  inflation_rate NUMERIC(5,4) DEFAULT 0.03, -- default 3% inflation
  is_discretionary BOOLEAN DEFAULT FALSE, -- can be cut if needed
  tax_deductible BOOLEAN DEFAULT FALSE,
  deduction_percentage NUMERIC(5,2), -- % deductible (if tax_deductible = true)
  start_date DATE,
  end_date DATE, -- NULL = indefinite
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_expense_streams_household ON expense_streams(household_id);
CREATE INDEX idx_expense_streams_category ON expense_streams(expense_category_id);
CREATE INDEX idx_expense_streams_active ON expense_streams(household_id, active);
CREATE INDEX idx_expense_streams_discretionary ON expense_streams(is_discretionary);

-- ============================================================================
-- POSITIONS (renamed to lots, create view for backward compatibility)
-- ============================================================================

-- The new schema uses 'lots' table, but old code references 'positions'
-- Create a view for backward compatibility
CREATE OR REPLACE VIEW positions AS
SELECT 
  id,
  account_id,
  symbol AS security_id, -- map symbol to security_id
  symbol,
  description,
  asset_class,
  quantity,
  cost_basis,
  acquisition_date,
  current_price AS price,
  market_value,
  unrealized_gain_loss,
  as_of_date,
  created_at,
  updated_at,
  metadata
FROM lots;

-- ============================================================================
-- PLANS (renamed to scenarios, create view for backward compatibility)
-- ============================================================================

CREATE OR REPLACE VIEW plans AS
SELECT
  id,
  household_id,
  scenario_name AS plan_name,
  scenario_type AS plan_type,
  is_baseline,
  created_by_user_id,
  created_at,
  run_at,
  assumptions,
  results_summary AS results,
  status,
  metadata
FROM scenarios;

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

CREATE TRIGGER relationships_updated_at BEFORE UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER income_streams_updated_at BEFORE UPDATE ON income_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER expense_streams_updated_at BEFORE UPDATE ON expense_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE relationships IS 'Person-to-person relationships (spouse, child, dependent, beneficiary)';
COMMENT ON TABLE income_streams IS 'Recurring income sources (salary, pension, social security, etc.)';
COMMENT ON TABLE expense_streams IS 'Recurring expenses with inflation indexing';
COMMENT ON TABLE expense_categories IS 'Standardized expense categorization';
COMMENT ON VIEW positions IS 'Backward-compatible view mapping lots → positions';
COMMENT ON VIEW plans IS 'Backward-compatible view mapping scenarios → plans';
