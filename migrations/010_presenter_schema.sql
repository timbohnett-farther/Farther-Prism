-- Migration 010: Presenter (Client Presentations) Schema

CREATE TABLE IF NOT EXISTS presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  presentation_type VARCHAR(50) NOT NULL, -- review, onboarding, planning, custom
  slides JSONB DEFAULT '[]',
  branding JSONB DEFAULT '{}',
  presenter_notes JSONB DEFAULT '{}',
  shared_url TEXT,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentations_household ON presentations(household_id);

CREATE TABLE IF NOT EXISTS presentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  presentation_type VARCHAR(50) NOT NULL,
  description TEXT,
  slides JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO presentation_templates (name, presentation_type, description, slides) VALUES
(
  'Quarterly Review Meeting',
  'review',
  'Standard quarterly review presentation for client meetings',
  '["title","agenda","portfolio_summary","performance","allocation","tax_efficiency","market_outlook","action_items","questions"]'::jsonb
),
(
  'New Client Onboarding',
  'onboarding',
  'Welcome presentation for new client relationships',
  '["title","welcome","about_farther","investment_philosophy","your_team","planning_overview","portfolio_strategy","technology","next_steps"]'::jsonb
),
(
  'Financial Planning Review',
  'planning',
  'Annual planning review with goals progress',
  '["title","agenda","goals_progress","retirement_projection","monte_carlo","tax_strategy","estate_planning","action_items","questions"]'::jsonb
);
