/**
 * Planning Graph Service
 * 
 * Orchestrates monthly financial projections combining:
 * - Cash flow engine (income, expenses, debt)
 * - Tax calculator (federal, state, IRMAA, NIIT)
 * - Withdrawal sequencer (optimal withdrawal strategy)
 * - Account tracker (contributions, growth, withdrawals)
 * - Portfolio returns (from Backblaze data lake)
 * 
 * Generates monthly planning_graph entries for database storage.
 */

import pool from '../db/pool.js';
import { TaxCalculator } from '../calculation/tax-calculator.js';
import { WithdrawalSequencer } from '../calculation/withdrawal-sequencer.js';

export class PlanningGraphService {
  constructor() {
    this.taxCalculator = new TaxCalculator();
    this.withdrawalSequencer = new WithdrawalSequencer();
  }

  /**
   * Generate planning graph for a scenario.
   * 
   * @param {string} scenarioId - Scenario UUID
   * @param {Object} scenario - Scenario data (assumptions, people, accounts, goals)
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Monthly planning graph entries
   */
  async generatePlanningGraph(scenarioId, scenario, options = {}) {
    const {
      startDate = new Date().toISOString().split('T')[0],
      endDate = null, // Auto-calculate based on life expectancy
      monthlyGranularity = true,
    } = options;

    console.log(`[PlanningGraph] Generating for scenario ${scenarioId}`);

    // Extract scenario data
    const {
      people = [],
      accounts = [],
      incomeStreams = [],
      expenseStreams = [],
      goals = [],
      assumptions = {},
    } = scenario;

    // Calculate projection end date (to age 100 or specified)
    const projectionEnd = endDate || this.calculateProjectionEnd(people, startDate);
    const months = this.getMonthsBetween(startDate, projectionEnd);

    console.log(`[PlanningGraph] Projecting ${months.length} months from ${startDate} to ${projectionEnd}`);

    // Initialize account balances
    let accountBalances = this.initializeAccountBalances(accounts);

    // Generate monthly entries
    const graphEntries = [];
    let cumulativeWithdrawals = 0;
    let cumulativeTaxes = 0;

    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const year = parseInt(month.substring(0, 4));
      const monthNum = parseInt(month.substring(5, 7));
      const age1 = this.calculateAge(people[0]?.dateOfBirth, month);
      const age2 = people[1] ? this.calculateAge(people[1].dateOfBirth, month) : null;

      // Calculate cash flow for this month
      const cashFlow = this.calculateMonthlyCashFlow({
        month,
        incomeStreams,
        expenseStreams,
        people,
        assumptions,
      });

      // Annual tax calculation (once per year in December)
      let taxes = { totalTax: 0, federalTax: 0, stateTax: 0, irmaa: { totalAnnual: 0 }, niit: 0 };
      let withdrawals = {};
      let rothConversion = { amount: 0 };

      if (monthNum === 12) {
        // Calculate annual income and expenses
        const annualIncome = cashFlow.totalIncome * 12;
        const annualExpenses = cashFlow.totalExpenses * 12;
        const annualSpendingNeed = Math.max(0, annualExpenses - annualIncome);

        // Optimize withdrawals
        const household = {
          state: assumptions.state || 'AZ',
          filingStatus: assumptions.filingStatus || 'married_joint',
          age1,
          age2,
        };

        const withdrawalPlan = this.withdrawalSequencer.optimizeWithdrawals(
          accountBalances,
          {
            targetSpending: annualSpendingNeed,
            otherIncome: annualIncome,
            allowRothWithdrawals: assumptions.allowRothWithdrawals || false,
            charitableGiving: assumptions.charitableGiving || 0,
            taxLossHarvesting: assumptions.taxLossHarvesting || 0,
            rothConversionBudget: assumptions.rothConversionBudget || 0,
          },
          household
        );

        withdrawals = withdrawalPlan.withdrawals;
        taxes = withdrawalPlan.taxes;
        rothConversion = withdrawalPlan.rothConversion;

        cumulativeTaxes += taxes.totalTax;
        cumulativeWithdrawals += withdrawalPlan.summary.grossWithdrawals;

        // Apply withdrawals to account balances
        Object.entries(withdrawals).forEach(([accountType, amount]) => {
          if (accountBalances[accountType]) {
            accountBalances[accountType] -= amount;
          }
        });

        // Apply Roth conversion
        if (rothConversion.amount > 0) {
          accountBalances.ira_traditional -= rothConversion.amount;
          accountBalances.ira_roth = (accountBalances.ira_roth || 0) + rothConversion.amount;
        }
      }

      // Apply portfolio growth (monthly)
      accountBalances = this.applyPortfolioGrowth(accountBalances, assumptions);

      // Track account-level detail
      const accountDetails = this.buildAccountDetails(accounts, accountBalances);

      // Build graph entry
      const entry = {
        scenario_id: scenarioId,
        month_date: month,
        month_index: i + 1,
        
        // Taxable bucket
        taxable_balance: accountBalances.taxable || 0,
        taxable_contributions: 0, // Calculated in account tracker
        taxable_withdrawals: withdrawals.taxable || 0,
        taxable_growth: 0, // Calculated separately
        
        // Tax-deferred bucket
        tax_deferred_balance: 
          (accountBalances.ira_traditional || 0) + 
          (accountBalances['401k_traditional'] || 0),
        tax_deferred_contributions: 0,
        tax_deferred_withdrawals: 
          (withdrawals.ira_traditional || 0) + 
          (withdrawals['401k_traditional'] || 0),
        tax_deferred_growth: 0,
        
        // Tax-free bucket
        tax_free_balance: accountBalances.ira_roth || 0,
        tax_free_contributions: 0,
        tax_free_withdrawals: withdrawals.ira_roth || 0,
        tax_free_growth: 0,
        
        // Cash flow
        total_income: cashFlow.totalIncome,
        total_expenses: cashFlow.totalExpenses,
        net_cash_flow: cashFlow.totalIncome - cashFlow.totalExpenses,
        
        // Withdrawals
        total_withdrawals: Object.values(withdrawals).reduce((sum, amt) => sum + amt, 0),
        
        // Taxes (annual, stored in December)
        federal_tax: taxes.federalTax,
        state_tax: taxes.stateTax,
        irmaa_surcharge: taxes.irmaa.totalAnnual,
        niit_tax: taxes.niit,
        total_tax: taxes.totalTax,
        
        // Goals (calculated separately)
        goals_funded: 0,
        goals_shortfall: 0,
        
        // Metadata
        age_primary: age1,
        age_secondary: age2,
        notes: monthNum === 12 ? `Annual tax: $${Math.round(taxes.totalTax).toLocaleString()}` : null,
      };

      graphEntries.push(entry);
    }

    console.log(`[PlanningGraph] Generated ${graphEntries.length} monthly entries`);
    console.log(`[PlanningGraph] Cumulative withdrawals: $${Math.round(cumulativeWithdrawals).toLocaleString()}`);
    console.log(`[PlanningGraph] Cumulative taxes: $${Math.round(cumulativeTaxes).toLocaleString()}`);

    return graphEntries;
  }

  /**
   * Store planning graph in database.
   */
  async storePlanningGraph(scenarioId, graphEntries) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete existing entries for this scenario
      await client.query(
        'DELETE FROM planning_graph WHERE scenario_id = $1',
        [scenarioId]
      );

      // Insert new entries
      for (const entry of graphEntries) {
        await client.query(`
          INSERT INTO planning_graph (
            scenario_id, month_date, month_index,
            taxable_balance, taxable_contributions, taxable_withdrawals, taxable_growth,
            tax_deferred_balance, tax_deferred_contributions, tax_deferred_withdrawals, tax_deferred_growth,
            tax_free_balance, tax_free_contributions, tax_free_withdrawals, tax_free_growth,
            total_income, total_expenses, net_cash_flow, total_withdrawals,
            federal_tax, state_tax, irmaa_surcharge, niit_tax, total_tax,
            goals_funded, goals_shortfall,
            age_primary, age_secondary, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
          )
        `, [
          entry.scenario_id, entry.month_date, entry.month_index,
          entry.taxable_balance, entry.taxable_contributions, entry.taxable_withdrawals, entry.taxable_growth,
          entry.tax_deferred_balance, entry.tax_deferred_contributions, entry.tax_deferred_withdrawals, entry.tax_deferred_growth,
          entry.tax_free_balance, entry.tax_free_contributions, entry.tax_free_withdrawals, entry.tax_free_growth,
          entry.total_income, entry.total_expenses, entry.net_cash_flow, entry.total_withdrawals,
          entry.federal_tax, entry.state_tax, entry.irmaa_surcharge, entry.niit_tax, entry.total_tax,
          entry.goals_funded, entry.goals_shortfall,
          entry.age_primary, entry.age_secondary, entry.notes
        ]);
      }

      await client.query('COMMIT');
      console.log(`[PlanningGraph] Stored ${graphEntries.length} entries for scenario ${scenarioId}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate monthly cash flow (income - expenses).
   */
  calculateMonthlyCashFlow({ month, incomeStreams, expenseStreams, people, assumptions }) {
    const monthDate = new Date(month);
    
    // Calculate monthly income
    let totalIncome = 0;
    incomeStreams.forEach(stream => {
      const startDate = new Date(stream.startDate);
      const endDate = stream.endDate ? new Date(stream.endDate) : null;
      
      if (monthDate >= startDate && (!endDate || monthDate <= endDate)) {
        const monthlyAmount = stream.frequency === 'annual' 
          ? stream.amount / 12 
          : stream.amount;
        totalIncome += monthlyAmount;
      }
    });
    
    // Calculate monthly expenses (with inflation)
    const inflationRate = assumptions.inflationRate || 0.03;
    const startDate = new Date(monthDate);
    const yearsSinceStart = (monthDate - startDate) / (1000 * 60 * 60 * 24 * 365);
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsSinceStart);
    
    let totalExpenses = 0;
    expenseStreams.forEach(stream => {
      const monthlyAmount = stream.frequency === 'monthly' 
        ? stream.amount 
        : stream.amount / 12;
      totalExpenses += monthlyAmount * inflationMultiplier;
    });
    
    return {
      totalIncome,
      totalExpenses,
      netCashFlow: totalIncome - totalExpenses,
    };
  }

  /**
   * Initialize account balances from accounts array.
   */
  initializeAccountBalances(accounts) {
    const balances = {
      taxable: 0,
      ira_traditional: 0,
      ira_roth: 0,
      '401k_traditional': 0,
      '401k_roth': 0,
    };

    accounts.forEach(account => {
      const type = account.account_type;
      if (balances.hasOwnProperty(type)) {
        balances[type] += account.current_value || 0;
      }
    });

    return balances;
  }

  /**
   * Apply portfolio growth (monthly).
   */
  applyPortfolioGrowth(balances, assumptions) {
    const annualReturn = assumptions.portfolioReturn || 0.07; // 7% default
    const monthlyReturn = Math.pow(1 + annualReturn, 1/12) - 1;

    const updated = {};
    Object.keys(balances).forEach(accountType => {
      updated[accountType] = balances[accountType] * (1 + monthlyReturn);
    });

    return updated;
  }

  /**
   * Build account-level details.
   */
  buildAccountDetails(accounts, balances) {
    return accounts.map(account => ({
      account_id: account.id,
      account_type: account.account_type,
      current_balance: balances[account.account_type] || 0,
    }));
  }

  /**
   * Calculate projection end date (age 100 or specified).
   */
  calculateProjectionEnd(people, startDate) {
    const primaryPerson = people[0];
    if (!primaryPerson || !primaryPerson.dateOfBirth) {
      // Default to 30 years from start
      const start = new Date(startDate);
      start.setFullYear(start.getFullYear() + 30);
      return start.toISOString().split('T')[0];
    }

    const birthDate = new Date(primaryPerson.dateOfBirth);
    const age100Date = new Date(birthDate);
    age100Date.setFullYear(age100Date.getFullYear() + 100);
    
    return age100Date.toISOString().split('T')[0];
  }

  /**
   * Get array of month strings between two dates.
   */
  getMonthsBetween(startDate, endDate) {
    const months = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}-01`);
      
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Calculate age from date of birth.
   */
  calculateAge(dateOfBirth, asOfDate) {
    if (!dateOfBirth) return null;
    
    const birth = new Date(dateOfBirth);
    const asOf = new Date(asOfDate);
    
    let age = asOf.getFullYear() - birth.getFullYear();
    const monthDiff = asOf.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }
}

export default PlanningGraphService;
