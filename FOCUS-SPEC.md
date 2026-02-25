# Focus - Portfolio Analytics & Optimization

**Module:** #3 in Farther Intelligence Suite  
**Tagline:** "Focus on what matters most. Go Farther."  
**Icon:** 🎯  
**Status:** Building Now  
**Priority:** High

---

## Overview

Focus is Farther's portfolio analytics and optimization tool. It provides advisors with deep insights into portfolio performance, asset allocation, tax efficiency, and rebalancing opportunities. The goal is to help advisors focus on high-impact actions that drive client outcomes.

---

## Core Features

### 1. **Performance Attribution**
Understand where returns are coming from.

**Capabilities:**
- Asset class contribution (stocks, bonds, alternatives, cash)
- Individual holding performance (winners and losers)
- Time-weighted returns vs. money-weighted returns
- Benchmark comparison (S&P 500, 60/40, custom)
- Attribution by account type (taxable, IRA, Roth)

**Visualization:**
- Waterfall chart (return sources)
- Performance vs. benchmark line chart
- Top/bottom performers table

---

### 2. **Asset Allocation Analysis**
Current vs. target allocation with drift alerts.

**Capabilities:**
- Current allocation breakdown (by asset class, sector, geography)
- Target allocation (from plan or model)
- Drift percentage (how far off target)
- Rebalancing suggestions (what to buy/sell)
- Projected outcome if left unbalanced

**Visualization:**
- Pie chart (current allocation)
- Target vs. actual bar chart
- Drift heatmap (red = over, green = under)

---

### 3. **Tax-Loss Harvesting Opportunities**
Identify losses to harvest for tax savings.

**Capabilities:**
- Unrealized loss identification (all taxable accounts)
- Wash sale rule compliance (30-day window)
- Replacement security suggestions (similar but not identical)
- Tax savings estimate (loss × marginal tax rate)
- Harvest workflow (mark, execute, track)

**Visualization:**
- Loss opportunity table (sorted by savings)
- Unrealized gain/loss chart
- Tax savings year-to-date

**Wash Sale Protection:**
- Check for purchases in last 30 days
- Flag violations before execution
- Suggest compliant alternatives

---

### 4. **Dividend & Income Analysis**
Track income generation and tax efficiency.

**Capabilities:**
- Dividend income by holding
- Qualified vs. non-qualified dividends
- Tax efficiency score (after-tax yield)
- Distribution calendar (when dividends are paid)
- DRIP vs. cash analysis (reinvest or take cash)

**Visualization:**
- Income timeline (monthly/quarterly)
- Qualified vs. non-qualified breakdown
- After-tax yield comparison

---

### 5. **Rebalancing Workflow**
Intelligent rebalancing with tax awareness.

**Capabilities:**
- Detect drift from target allocation
- Suggest tax-efficient trades (prioritize tax-deferred)
- Minimize taxable events
- Account for cash flows (deposits, withdrawals)
- One-click rebalance execution

**Tax-Aware Logic:**
- Rebalance in IRAs first (no tax impact)
- Harvest losses while rebalancing
- Avoid short-term gains when possible
- Consider asset location (tax-efficient placement)

**Visualization:**
- Trade list (what to buy/sell)
- Tax impact estimate (before execution)
- Projected allocation (after rebalance)

---

### 6. **Concentrated Position Analysis**
Identify and manage concentration risk.

**Capabilities:**
- Detect holdings >5% of portfolio
- Track single-stock risk
- Suggest diversification strategies
- Tax-efficient exit planning (staged selling)

**Risk Metrics:**
- Concentration score (0-100)
- Beta to benchmark
- Downside scenario (if stock drops 20%)

---

### 7. **Fee & Expense Analysis**
Understand cost drag on returns.

**Capabilities:**
- Expense ratios by holding
- Total portfolio cost (weighted average)
- Fee comparison vs. low-cost alternatives
- Projected 10-year cost drag

**Visualization:**
- Expense ratio distribution
- Cost drag chart (fees over time)
- Low-cost alternatives table

---

## User Experience

### Advisor Workflow:

**Step 1: Overview**
- Portfolio summary (total value, allocation, performance)
- Key metrics (YTD return, vs. benchmark, drift %)
- Alert cards (rebalancing needed, tax-loss opportunities)

**Step 2: Performance**
- Attribution analysis (where returns came from)
- Benchmark comparison
- Top/bottom performers

**Step 3: Allocation**
- Current vs. target allocation
- Drift analysis
- Rebalancing suggestions

**Step 4: Tax Optimization**
- Tax-loss harvesting opportunities
- Unrealized gains/losses
- Dividend efficiency

**Step 5: Actions**
- One-click rebalance
- Harvest losses
- Execute trades

---

## Technical Architecture

### Database Schema:

```sql
-- Portfolio holdings (positions)
-- Already exists: lots table
-- Columns: account_id, symbol, quantity, cost_basis, current_price

-- Performance history
CREATE TABLE performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  date DATE NOT NULL,
  total_value NUMERIC(15,2),
  cash_value NUMERIC(15,2),
  invested_value NUMERIC(15,2),
  daily_return_pct NUMERIC(7,4), -- e.g., 0.0125 = 1.25%
  ytd_return_pct NUMERIC(7,4),
  inception_return_pct NUMERIC(7,4),
  benchmark_return_pct NUMERIC(7,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset allocation targets
CREATE TABLE allocation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  asset_class VARCHAR(50), -- stocks, bonds, alternatives, cash
  target_percentage NUMERIC(5,4), -- e.g., 0.6000 = 60%
  min_percentage NUMERIC(5,4),
  max_percentage NUMERIC(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax-loss harvest opportunities
CREATE TABLE tax_loss_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  lot_id UUID REFERENCES lots(id),
  symbol VARCHAR(20),
  quantity NUMERIC(15,4),
  cost_basis NUMERIC(15,2),
  current_value NUMERIC(15,2),
  unrealized_loss NUMERIC(15,2),
  estimated_tax_savings NUMERIC(15,2),
  replacement_symbol VARCHAR(20), -- Alternative security
  status VARCHAR(50) DEFAULT 'identified', -- identified, harvested, skipped
  wash_sale_violation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  harvested_at TIMESTAMPTZ
);

-- Rebalancing recommendations
CREATE TABLE rebalance_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, executed, dismissed
  total_drift NUMERIC(7,4), -- Total absolute drift %
  tax_impact NUMERIC(15,2), -- Estimated tax cost
  trades JSONB, -- Array of { symbol, action, quantity, account }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);
```

---

### API Endpoints:

```
GET  /api/v1/focus/:householdId/overview        - Portfolio summary
GET  /api/v1/focus/:householdId/performance     - Performance attribution
GET  /api/v1/focus/:householdId/allocation      - Current vs. target allocation
GET  /api/v1/focus/:householdId/tax-loss        - Tax-loss opportunities
GET  /api/v1/focus/:householdId/rebalance       - Rebalancing recommendations
POST /api/v1/focus/:householdId/rebalance/execute - Execute rebalance trades
POST /api/v1/focus/:householdId/harvest/:id    - Harvest a tax loss
GET  /api/v1/focus/:householdId/dividends       - Dividend income analysis
GET  /api/v1/focus/:householdId/fees            - Fee & expense analysis
```

---

### Calculation Engine:

**Performance Attribution:**
- Load holdings and historical prices
- Calculate daily/monthly/YTD returns
- Attribute returns to asset classes
- Compare to benchmark

**Asset Allocation:**
- Aggregate holdings by asset class
- Compare to target allocation
- Calculate drift %
- Generate rebalancing trades

**Tax-Loss Harvesting:**
- Find lots with unrealized losses (current_value < cost_basis)
- Check wash sale violations (purchases in last 30 days)
- Estimate tax savings (loss × marginal_rate)
- Suggest replacement securities (correlation check)

**Rebalancing Logic:**
1. Calculate current allocation
2. Calculate target allocation
3. Identify overweight/underweight assets
4. Generate trades (sell overweight, buy underweight)
5. Prioritize tax-deferred accounts (minimize tax impact)
6. Account for cash flows

---

## Key Metrics

**Performance:**
- YTD return
- Inception return
- Time-weighted return (TWR)
- Money-weighted return (MWR)
- vs. Benchmark

**Risk:**
- Standard deviation
- Sharpe ratio
- Max drawdown
- Beta

**Tax Efficiency:**
- After-tax return
- Tax-loss harvest value (YTD)
- Dividend efficiency

**Allocation:**
- Drift % (current vs. target)
- Concentration risk
- Diversification score

---

## MVP Scope

### Must-Have (Week 1):
- [ ] Database schema (performance, allocation, tax-loss)
- [ ] Portfolio overview API (summary stats)
- [ ] Performance attribution (simple)
- [ ] Allocation drift detection
- [ ] Tax-loss opportunity scanner

### Should-Have (Week 2):
- [ ] Rebalancing workflow
- [ ] Tax-aware rebalancing
- [ ] Dividend analysis
- [ ] Fee analysis
- [ ] UI components (charts, tables)

### Nice-to-Have (Future):
- [ ] One-click rebalance execution
- [ ] Automated tax-loss harvesting (daily scan)
- [ ] Portfolio optimization (efficient frontier)
- [ ] Risk scenario analysis
- [ ] Custom benchmarks

---

## Competitive Positioning

**vs. eMoney/RightCapital:**
- Faster (real-time recalculation)
- More tax-aware (lot-level tracking)
- Better asset location logic
- Automated opportunity scanning

**vs. Orion/Black Diamond:**
- Simpler (advisor-friendly UI)
- More integrated (Planning + Portfolio in one)
- Better for smaller RIAs (not enterprise overkill)

**vs. Personal Capital:**
- Advisor-focused (not retail)
- More sophisticated (lot-level, tax strategies)
- Better alternatives support

---

## Success Metrics

**Adoption:**
- Portfolios analyzed per advisor/month
- Tax-loss opportunities identified
- Rebalancing actions taken

**Value Delivered:**
- Tax savings (harvested losses × rate)
- Drift reduction (average drift % before/after)
- Time saved (automated vs. manual analysis)

**Target:**
- 80%+ of advisors use Focus monthly
- Average $5K+ tax savings per client/year
- <5 minutes to analyze portfolio

---

**Status:** Specification complete, ready to build

*Next: Database schema → API → Calculation engine → UI*
