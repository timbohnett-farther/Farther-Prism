# Farther Prism - Database Schema Documentation

**Platform:** PostgreSQL 17.7 (Railway)  
**Architecture:** Household-first, versioned scenarios, monthly projections  
**Version:** 1.0  
**Created:** February 24, 2026

---

## Overview

Institutional-grade financial planning database designed for:
- Multi-generational household planning
- Tax-aware projections with monthly granularity
- Versioned scenario comparison
- Full audit trail for compliance
- Scalable to 10,000+ households

---

## Entity Relationship Model

```
households (1) ──< people (N)
           (1) ──< entities (N) [trusts, LLCs]
           (1) ──< accounts (N)
           (1) ──< goals (N)
           (1) ──< scenarios (N)
           (1) ──< audit_log (N)

accounts (1) ──< lots (N) [tax lots]

scenarios (1) ──< planning_graph (N) [monthly steps]
          (1) ──< monte_carlo_results (N)
```

---

## Core Tables

### households
Top-level container for all client data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_name | VARCHAR(255) | Display name |
| primary_advisor_id | UUID | FK to users (future) |
| status | VARCHAR(50) | active, inactive, archived |
| metadata | JSONB | Flexible extension data |

**Key Indexes:**
- `idx_households_advisor` - Fast advisor lookups
- `idx_households_status` - Filter active households

---

### people
Individuals in household (clients, spouses, dependents, beneficiaries).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| first_name | VARCHAR(100) | |
| last_name | VARCHAR(100) | |
| date_of_birth | DATE | For age calculations |
| relationship | VARCHAR(50) | primary, spouse, child, dependent, beneficiary |
| ssn_encrypted | TEXT | Encrypted SSN (PII) |
| is_primary | BOOLEAN | Primary household member |
| life_expectancy_override | INT | Manual override for planning |

**Key Constraints:**
- Cascade delete with household
- One primary per household (enforced in app logic)

---

### entities
Trusts, LLCs, foundations, etc.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| entity_name | VARCHAR(255) | Trust/entity name |
| entity_type | VARCHAR(100) | revocable_trust, irrevocable_trust, llc, foundation |
| ein_encrypted | TEXT | Encrypted EIN (PII) |
| grantor_id | UUID | FK to people |
| trustee_id | UUID | FK to people |

---

### accounts
Financial accounts (IRAs, 401ks, taxable, trusts, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| account_number_encrypted | TEXT | Encrypted account # |
| account_name | VARCHAR(255) | Display name |
| account_type | VARCHAR(100) | ira_traditional, ira_roth, 401k, taxable, etc. |
| tax_treatment | VARCHAR(50) | tax_deferred, tax_free, taxable |
| custodian | VARCHAR(255) | Schwab, Fidelity, etc. |
| owner_person_id | UUID | FK to people (XOR with owner_entity_id) |
| owner_entity_id | UUID | FK to entities |
| current_value | NUMERIC(15,2) | Latest balance |
| as_of_date | DATE | Data freshness |
| is_managed | BOOLEAN | Managed by advisor vs held-away |

**Key Constraints:**
- `account_owner_check` - Must have exactly one owner (person OR entity)

**Reference Table:** `account_types_ref`
- Pre-populated with 14 common account types
- Includes 2026 contribution limits

---

### lots
Individual tax lots with cost basis tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | FK to accounts |
| symbol | VARCHAR(50) | Ticker |
| description | VARCHAR(255) | Security name |
| asset_class | VARCHAR(100) | us_equity, bonds, real_estate, etc. |
| quantity | NUMERIC(15,6) | Shares/units |
| cost_basis | NUMERIC(15,2) | Total cost |
| acquisition_date | DATE | Purchase date |
| current_price | NUMERIC(15,4) | Latest price |
| market_value | NUMERIC(15,2) | Qty × price |
| unrealized_gain_loss | NUMERIC(15,2) | **Generated column** (market_value - cost_basis) |
| as_of_date | DATE | Data freshness |

**Computed Columns:**
- `unrealized_gain_loss` auto-calculated on insert/update

---

### goals
Client objectives (retirement, college, legacy, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| goal_name | VARCHAR(255) | Display name |
| goal_type | VARCHAR(100) | retirement, college, legacy, major_purchase |
| priority | INT | 1=essential, 2=important, 3=aspirational |
| target_amount | NUMERIC(15,2) | Goal funding target |
| target_date | DATE | When goal is needed |
| person_id | UUID | FK to people (who is this for?) |
| funding_status | VARCHAR(50) | not_started, on_track, at_risk, funded |

---

### scenarios
Versioned planning runs with assumptions and results.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| scenario_name | VARCHAR(255) | "Base Case 2026", "Optimistic", etc. |
| scenario_type | VARCHAR(50) | base, optimistic, pessimistic, custom |
| is_baseline | BOOLEAN | Only one baseline per household |
| assumptions | JSONB | Inflation, returns, tax rates, life expectancy |
| results_summary | JSONB | Success rate, ending wealth, shortfall years |
| status | VARCHAR(50) | draft, running, completed, archived |
| run_at | TIMESTAMPTZ | When calculation completed |

**Key Features:**
- **Versioning:** Compare scenarios side-by-side
- **Assumptions snapshot:** Reproducible runs
- **Results cache:** Avoid re-running expensive calculations

---

### planning_graph
Monthly projection steps (cash flow + balance evolution).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scenario_id | UUID | FK to scenarios |
| step_date | DATE | First of month |
| step_number | INT | 0, 1, 2, ... (0 = current state) |
| age_primary | INT | Primary person age |
| age_spouse | INT | Spouse age |
| **Cash Flows** | | |
| income_earned | NUMERIC(15,2) | W-2, 1099, business income |
| income_social_security | NUMERIC(15,2) | SS benefits |
| income_pension | NUMERIC(15,2) | Pension payments |
| income_other | NUMERIC(15,2) | Other income |
| expenses_living | NUMERIC(15,2) | Living expenses |
| expenses_healthcare | NUMERIC(15,2) | Healthcare costs |
| expenses_discretionary | NUMERIC(15,2) | Discretionary spending |
| taxes_federal | NUMERIC(15,2) | Federal tax |
| taxes_state | NUMERIC(15,2) | State tax |
| taxes_fica | NUMERIC(15,2) | FICA/Medicare |
| **Balances** | | |
| balance_taxable | NUMERIC(15,2) | End-of-month taxable balance |
| balance_tax_deferred | NUMERIC(15,2) | IRA/401k balances |
| balance_tax_free | NUMERIC(15,2) | Roth balances |
| balance_total | NUMERIC(15,2) | **Generated:** sum of all buckets |
| **Withdrawals/Contributions** | | |
| withdrawal_taxable | NUMERIC(15,2) | Withdrawals from taxable |
| withdrawal_tax_deferred | NUMERIC(15,2) | IRA/401k withdrawals |
| withdrawal_tax_free | NUMERIC(15,2) | Roth withdrawals |
| contribution_401k | NUMERIC(15,2) | 401k contributions |
| contribution_ira | NUMERIC(15,2) | IRA contributions |
| contribution_roth | NUMERIC(15,2) | Roth contributions |
| **RMDs** | | |
| rmd_required | NUMERIC(15,2) | Required minimum distribution |
| rmd_taken | NUMERIC(15,2) | Actual RMD taken |

**Key Features:**
- **Monthly granularity** (not annual) - institutional accuracy
- **Tax-aware buckets** (taxable, tax-deferred, tax-free)
- **Withdrawal sequencing** tracked
- **RMD compliance** monitoring

---

### monte_carlo_results
Simulation outputs for risk assessment.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scenario_id | UUID | FK to scenarios |
| num_simulations | INT | Number of Monte Carlo paths |
| success_rate | NUMERIC(5,2) | % of paths that don't run out (0-100) |
| median_ending_wealth | NUMERIC(15,2) | 50th percentile outcome |
| percentile_10_wealth | NUMERIC(15,2) | 10th percentile (pessimistic) |
| percentile_90_wealth | NUMERIC(15,2) | 90th percentile (optimistic) |
| first_failure_year | INT | Median year of first depletion |
| max_shortfall | NUMERIC(15,2) | Worst-case shortfall |
| run_duration_ms | INT | Calculation time |
| paths | JSONB | Sample paths for visualization |

---

### audit_log
Compliance trail for all system changes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| household_id | UUID | FK to households |
| user_id | UUID | FK to users (future) |
| action | VARCHAR(100) | create, update, delete, run_scenario, approve |
| entity_type | VARCHAR(100) | household, account, scenario, etc. |
| entity_id | UUID | ID of modified entity |
| changes | JSONB | Before/after snapshot |
| ip_address | INET | Client IP |
| user_agent | TEXT | Browser/client info |
| created_at | TIMESTAMPTZ | When action occurred |

**Key Features:**
- **Immutable log** (no updates/deletes)
- **Full change tracking** (before/after in JSONB)
- **Regulatory compliance** (SOC 2, SEC requirements)

---

## Views

### household_summary
Convenience view for dashboard queries.

```sql
SELECT 
  h.id,
  h.household_name,
  COUNT(DISTINCT p.id) AS num_people,
  COUNT(DISTINCT a.id) AS num_accounts,
  SUM(a.current_value) AS total_aum,
  MAX(a.as_of_date) AS latest_data_date
FROM households h
LEFT JOIN people p ON h.id = p.household_id
LEFT JOIN accounts a ON h.id = a.household_id
GROUP BY h.id;
```

---

## Indexes

**Performance-critical indexes:**
- All foreign keys indexed
- `planning_graph(scenario_id, step_date)` - Fast date range queries
- `audit_log(created_at DESC)` - Recent activity queries
- `lots(symbol)` - Fast security lookups

---

## Data Types & Precision

**Money:** `NUMERIC(15,2)` - Supports up to $999 trillion with cent precision  
**Quantities:** `NUMERIC(15,6)` - Fractional shares (mutual funds, crypto)  
**UUIDs:** Universal across all primary keys (portable, no collisions)  
**JSONB:** Flexible metadata, indexed with GIN for fast queries

---

## Security & Compliance

**Encrypted Fields:**
- `people.ssn_encrypted` - SSN stored encrypted at rest
- `entities.ein_encrypted` - EIN stored encrypted
- `accounts.account_number_encrypted` - Account numbers encrypted

**Encryption Method:** `pgcrypto` extension (AES-256)

**Audit Trail:**
- All mutations logged to `audit_log`
- Before/after snapshots in JSONB
- IP + user agent tracking

---

## Scaling Considerations

**Current Design Supports:**
- 10,000+ households
- 100,000+ accounts
- 1,000,000+ lots
- 10,000,000+ planning_graph rows (1,000 scenarios × 360 months × ~30 households)

**Future Optimizations:**
- Partition `planning_graph` by scenario_id (when > 10M rows)
- Archive old `audit_log` entries (> 1 year) to cold storage
- Add materialized views for dashboard aggregations

---

## Next Steps

### Phase 1 (This Week)
- [ ] Build ORM layer (Prisma or raw SQL)
- [ ] Create API endpoints for CRUD operations
- [ ] Connect Prism prototype to new schema
- [ ] Migrate prototype data to household structure

### Phase 2 (Week 2)
- [ ] Build statement parser → populate accounts + lots
- [ ] Implement scenario versioning logic
- [ ] Build planning graph calculator (monthly cash flows)
- [ ] Tax engine integration

### Phase 3 (Week 3-4)
- [ ] Monte Carlo engine → write results to DB
- [ ] Reporting engine (PDF generation from planning_graph)
- [ ] Advisor dashboard (household_summary view)
- [ ] Performance optimization

---

## Connection Info

**Stored in:** `.env.database` (gitignored)  
**Connection String:** `postgresql://postgres:***@shortline.proxy.rlwy.net:38237/railway`

---

## Maintenance

**Migrations:**
- Stored in `migrations/` directory
- Run with `node run-migration.js`
- Version controlled (001_, 002_, etc.)

**Backups:**
- Railway automated daily backups (retained 7 days)
- Manual backups: `pg_dump` before major schema changes

---

## Support

**Schema Questions:** Check this document first  
**Migration Issues:** Review `migrations/001_initial_schema.sql`  
**Data Issues:** Query `audit_log` for change history  
**Contact:** ledger@the-ai-team.io
