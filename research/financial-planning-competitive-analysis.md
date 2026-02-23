# Financial Planning Platform - Competitive Analysis
## eMoney vs RightCapital vs Farther Prism

**Last Updated:** 2026-02-23  
**Purpose:** Build a best-in-class financial planning platform

---

## Core Features Comparison

### 1. **Data Aggregation & Account Linking**

#### eMoney Advisor
- **Strengths:**
  - Data aggregation from 16,000+ institutions
  - Real-time account syncing
  - Automated daily updates
  - Strong institutional connections
- **Weaknesses:**
  - Slow refresh times (can take hours)
  - Manual intervention required for connection issues
  - Limited API customization
  - Expensive per-advisor licensing

#### RightCapital
- **Strengths:**
  - Faster aggregation (minutes vs hours)
  - Better error handling for broken connections
  - Modern API architecture
- **Weaknesses:**
  - Fewer institution connections (~12,000)
  - Less mature data cleaning
  - Manual data entry still common

#### **Farther Prism Advantage:**
- ✅ **AI-powered data reconciliation** - auto-fix connection issues
- ✅ **Instant aggregation** - sub-second refresh via optimized APIs
- ✅ **Smart categorization** - ML-based transaction classification
- ✅ **Predictive updates** - anticipate account changes before they happen

---

### 2. **Financial Planning Engine**

#### eMoney Advisor
**Inputs:**
- Client demographics (age, income, retirement date)
- Assets & liabilities
- Insurance policies
- Estate documents
- Tax returns
- Goals (retirement, education, major purchases)

**Planning Modules:**
- Net worth tracking
- Cash flow analysis
- Retirement planning (deterministic only)
- Education funding
- Insurance needs analysis
- Estate planning
- Tax projections (basic)

**Outputs:**
- Static financial plans (PDF reports)
- Net worth statements
- Cash flow projections
- Goal funding analysis

**Weaknesses:**
- ❌ No Monte Carlo simulations
- ❌ Limited tax optimization
- ❌ No AI recommendations
- ❌ Outdated UI (feels like 2010)
- ❌ Slow report generation (5-10 minutes)

#### RightCapital
**Inputs:**
- Similar to eMoney
- Better tax data integration
- Social Security optimization data
- Roth conversion analysis inputs

**Planning Modules:**
- All eMoney features PLUS:
- **Monte Carlo simulations** (10,000 iterations)
- Advanced tax planning
- Roth conversion optimizer
- Social Security timing optimizer
- Required Minimum Distribution (RMD) planning
- Estate tax projections

**Outputs:**
- Interactive financial plans
- Probability-of-success analysis
- Tax-efficient withdrawal strategies
- What-if scenario modeling
- Client-friendly visualizations

**Strengths:**
- ✅ Modern UI
- ✅ Monte Carlo built-in
- ✅ Tax optimization focus
- ✅ Faster performance

**Weaknesses:**
- ❌ Still advisor-driven (not AI-assisted)
- ❌ Limited automation
- ❌ No predictive insights
- ❌ Manual plan updates

---

### 3. **Client Portal & Engagement**

#### eMoney Advisor
- Decision Center (shows financial impact of decisions)
- Client organizer (document storage)
- Net worth tracking
- Goal progress
- Mobile app (basic)

**Weaknesses:**
- Clunky UX
- Limited client self-service
- No AI chatbot
- Minimal engagement tools

#### RightCapital
- Cleaner portal UI
- Better mobile experience
- What-if scenario tools for clients
- Goal tracking with progress bars

**Weaknesses:**
- Still requires advisor to initiate most actions
- No AI guidance for clients
- Limited personalization

#### **Farther Prism Advantage:**
- ✅ **AI Financial Coach** - 24/7 client support
- ✅ **Proactive alerts** - "Your tax strategy changed"
- ✅ **Smart recommendations** - personalized, context-aware
- ✅ **One-click optimization** - accept AI suggestions instantly

---

### 4. **Advisor Workflow**

#### Pain Points (Both Platforms):
1. ⏰ **Time-consuming data entry** (2-4 hours per new client)
2. 📊 **Manual plan updates** (every quarter = 30-60 min)
3. 🔄 **No automation** for routine tasks
4. 📧 **Client communication** done outside the platform
5. 🎯 **No AI suggestions** for advisors

#### **Farther Prism Solution:**
- ✅ **AI Data Extraction** - OCR from statements, auto-populate
- ✅ **Auto-update plans** - quarterly refresh with one click
- ✅ **Smart alerts** - "Client X needs Roth conversion review"
- ✅ **Integrated communication** - email/SMS from platform
- ✅ **AI Co-Pilot** - "Based on client Y's portfolio, consider..."

---

## Key Differentiators for Farther Prism

### 1. **AI-First Architecture**
- Natural language planning ("I want to retire at 62")
- Auto-generate comprehensive plans
- Continuous optimization
- Predictive analytics

### 2. **Speed**
- **eMoney/RightCapital:** 5-10 min plan generation
- **Farther Prism:** <10 seconds (already proven with Monte Carlo)

### 3. **Tax Intelligence**
- Real-time tax impact analysis
- Automated Roth conversion recommendations
- Tax-loss harvesting integration
- Multi-year tax projections

### 4. **Automation**
- Auto-rebalancing recommendations
- Smart withdrawal strategies
- Proactive risk adjustments
- Automated compliance documentation

### 5. **Modern Tech Stack**
- Fast (Node.js/Bun)
- Scalable (CockroachDB)
- Secure (SOC 2 ready)
- Beautiful (Farther brand)

---

## Feature Roadmap: Farther Prism Financial Planning Platform

### Phase 1: Foundation (Tonight - Week 1)
1. ✅ Client intake & data collection
2. ✅ Portfolio aggregation & analysis
3. ✅ Risk assessment (already built)
4. ✅ Monte Carlo engine (already built)
5. 🔨 **Cash flow analysis**
6. 🔨 **Goal planning engine**
7. 🔨 **Retirement income projections**

### Phase 2: Intelligence (Week 2-3)
1. Tax optimization engine
2. Social Security optimizer
3. Roth conversion analyzer
4. Estate planning module
5. Insurance needs calculator

### Phase 3: Automation (Week 4)
1. AI plan generation
2. Auto-update workflows
3. Smart recommendations
4. Client engagement tools

### Phase 4: Integration (Month 2)
1. Custodian connections
2. CRM integration
3. Document management
4. Compliance reporting

---

## Data Model: Financial Planning Inputs

### Client Profile
```typescript
{
  personal: {
    name: string
    age: number
    retirementAge: number
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed'
    dependents: number
    state: string  // for tax calculations
  }
  
  income: {
    salary: number
    bonus: number
    selfEmployment: number
    rentalIncome: number
    socialSecurity: number  // estimated or actual
    pension: number
    otherIncome: number
  }
  
  expenses: {
    housing: number
    healthcare: number
    insurance: number
    transportation: number
    food: number
    discretionary: number
    taxes: number
    other: number
  }
  
  assets: {
    taxable: Asset[]        // brokerage accounts
    taxDeferred: Asset[]    // 401k, Traditional IRA
    taxFree: Asset[]        // Roth IRA, Roth 401k
    realEstate: Asset[]
    business: Asset[]
    cash: number
    other: Asset[]
  }
  
  liabilities: {
    mortgage: Liability[]
    studentLoans: Liability[]
    autoLoans: Liability[]
    creditCards: Liability[]
    other: Liability[]
  }
  
  insurance: {
    life: LifeInsurance[]
    disability: DisabilityInsurance[]
    longTermCare: LTCInsurance[]
    health: HealthInsurance
  }
  
  goals: {
    retirement: RetirementGoal
    education: EducationGoal[]
    majorPurchases: PurchaseGoal[]
    legacy: LegacyGoal
  }
  
  taxSituation: {
    filingStatus: string
    federalBracket: number
    stateTaxRate: number
    capitalGainsRate: number
    estimatedTaxes: number
  }
}
```

---

## Planning Calculations

### 1. Net Worth
```
Total Assets - Total Liabilities = Net Worth
```

### 2. Retirement Income Need
```
Current Expenses × Replacement Ratio (70-90%) = Retirement Income Need
```

### 3. Retirement Savings Gap
```
(Retirement Income Need - Social Security - Pensions) × Years in Retirement / Withdrawal Rate
```

### 4. Probability of Success (Monte Carlo)
- Already built! (47ms for 10,000 simulations)
- Use existing engine with expanded inputs

### 5. Tax-Optimized Withdrawal Strategy
```
Priority Order:
1. Taxable accounts (lowest tax impact)
2. Tax-deferred (Traditional IRA/401k)
3. Tax-free (Roth - save for last)

Optimize yearly to minimize lifetime taxes
```

### 6. Social Security Timing
```
Options: Age 62, 67, 70
Calculate lifetime value considering:
- Life expectancy
- Spousal benefits
- Tax implications
- Portfolio longevity
```

---

## Next Steps: Start Building

**Priority Order:**
1. **Cash Flow Engine** - income/expense tracking & projections
2. **Goal Planning** - retirement, education, major purchases
3. **Retirement Income Module** - withdrawal strategies
4. **Tax Optimizer** - Roth conversions, tax-loss harvesting
5. **Social Security Optimizer** - timing analysis
6. **AI Recommendations** - smart suggestions for advisors

**Target: Core planning engine operational by morning.**

---

**Status:** Ready to build. Starting with cash flow and goal planning modules.
