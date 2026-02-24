/**
 * Withdrawal Sequencing Optimizer
 * 
 * Optimizes the order and amounts of withdrawals from different account types
 * to minimize taxes and maximize after-tax income.
 * 
 * Strategy hierarchy:
 * 1. Required Minimum Distributions (RMDs) - must take first
 * 2. Taxable accounts - already taxed, only pay cap gains
 * 3. Tax-deferred (Traditional IRA/401k) - pay ordinary income tax
 * 4. Tax-free (Roth IRA) - preserve for legacy/emergencies
 * 
 * Advanced optimizations:
 * - Fill lower tax brackets efficiently
 * - Avoid IRMAA cliffs
 * - Roth conversions in low-income years
 * - QCDs (Qualified Charitable Distributions) for RMDs
 * - Tax-loss harvesting in taxable accounts
 */

import { TaxCalculator } from './tax-calculator.js';

export class WithdrawalSequencer {
  constructor() {
    this.taxCalculator = new TaxCalculator();
    // RMD life expectancy factors (IRS Uniform Lifetime Table, 2022+)
    this.lifeExpectancyFactors = {
      73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
      79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
      85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2,
      91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
      97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
    };
  }

  /**
   * Optimize withdrawal strategy to meet spending need.
   * 
   * @param {Object} accounts - Account balances by type
   * @param {Object} needs - Spending needs
   * @param {Object} household - Household info
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized withdrawal plan
   */
  optimizeWithdrawals(accounts, needs, household, options = {}) {
    const {
      targetSpending = 0,
      otherIncome = 0,          // Social Security, pension, etc.
      allowRothWithdrawals = false, // Preserve Roth by default
      charitableGiving = 0,     // Use QCDs if possible
      taxLossHarvesting = 0,    // Available losses to harvest
      rothConversionBudget = 0, // Extra capacity for Roth conversions
    } = needs;

    const {
      state = 'AZ',
      filingStatus = 'married_joint',
      age1 = 65,
      age2 = null,
    } = household;

    // Step 1: Calculate RMDs (required withdrawals)
    const rmds = this.calculateRMDs(accounts, age1, age2);
    
    // Step 2: Calculate spending gap (after RMDs and other income)
    const totalRMDs = Object.values(rmds).reduce((sum, amt) => sum + amt, 0);
    const incomeAfterRMDs = otherIncome + totalRMDs;
    const spendingGap = Math.max(0, targetSpending - incomeAfterRMDs);

    // Step 3: Optimize additional withdrawals to fill gap
    const sequence = this.buildWithdrawalSequence(
      accounts,
      rmds,
      spendingGap,
      household,
      {
        allowRothWithdrawals,
        charitableGiving,
        taxLossHarvesting,
      }
    );

    // Step 4: Calculate tax liability
    const income = this.calculateIncome(sequence, otherIncome);
    const taxes = this.taxCalculator.calculateTax(income, household);

    // Step 5: Check for Roth conversion opportunity
    const rothConversion = this.optimizeRothConversion(
      accounts,
      income,
      household,
      rothConversionBudget,
      taxes
    );

    // Step 6: Calculate after-tax spending power
    const grossWithdrawals = Object.values(sequence.withdrawals).reduce((sum, amt) => sum + amt, 0);
    const afterTaxSpending = grossWithdrawals + otherIncome - taxes.totalTax;

    return {
      withdrawals: sequence.withdrawals,
      rmds,
      income,
      taxes,
      rothConversion,
      summary: {
        targetSpending,
        grossWithdrawals,
        otherIncome,
        totalIncome: grossWithdrawals + otherIncome,
        totalTax: taxes.totalTax,
        afterTaxSpending,
        shortfall: Math.max(0, targetSpending - afterTaxSpending),
      },
      optimization: {
        qcdUsed: sequence.qcdUsed,
        taxLossHarvested: sequence.taxLossHarvested,
        rothConversionAmount: rothConversion.amount,
        efficiencyScore: this.calculateEfficiencyScore(sequence, taxes),
      },
    };
  }

  /**
   * Calculate RMDs for all applicable accounts.
   */
  calculateRMDs(accounts, age1, age2) {
    const rmds = {};
    
    // Traditional IRA RMDs
    if (accounts.ira_traditional > 0) {
      const age = Math.max(age1, age2 || 0);
      if (age >= 73) {
        const factor = this.lifeExpectancyFactors[age] || this.lifeExpectancyFactors[100];
        rmds.ira_traditional = accounts.ira_traditional / factor;
      }
    }

    // 401(k) RMDs
    if (accounts['401k_traditional'] > 0) {
      const age = Math.max(age1, age2 || 0);
      if (age >= 73) {
        const factor = this.lifeExpectancyFactors[age] || this.lifeExpectancyFactors[100];
        rmds['401k_traditional'] = accounts['401k_traditional'] / factor;
      }
    }

    return rmds;
  }

  /**
   * Build optimized withdrawal sequence.
   */
  buildWithdrawalSequence(accounts, rmds, spendingGap, household, options) {
    const withdrawals = { ...rmds }; // Start with RMDs
    let remaining = spendingGap;
    let qcdUsed = 0;
    let taxLossHarvested = 0;

    // Apply QCDs (Qualified Charitable Distributions) first
    if (options.charitableGiving > 0 && rmds.ira_traditional > 0) {
      const maxQCD = Math.min(options.charitableGiving, 105000, rmds.ira_traditional);
      qcdUsed = maxQCD;
      withdrawals.qcd = maxQCD;
      remaining = Math.max(0, remaining - maxQCD); // QCD counts toward spending
    }

    // Strategy 1: Taxable accounts (cap gains rates)
    if (remaining > 0 && accounts.taxable > 0) {
      const taxableWithdrawal = Math.min(remaining, accounts.taxable);
      withdrawals.taxable = (withdrawals.taxable || 0) + taxableWithdrawal;
      remaining -= taxableWithdrawal;

      // Apply tax-loss harvesting if available
      if (options.taxLossHarvesting > 0) {
        taxLossHarvested = Math.min(options.taxLossHarvesting, taxableWithdrawal * 0.3); // ~30% could be losses
      }
    }

    // Strategy 2: Tax-deferred (Traditional IRA/401k)
    if (remaining > 0) {
      // Traditional IRA
      if (accounts.ira_traditional > 0) {
        const available = accounts.ira_traditional - (rmds.ira_traditional || 0);
        const iraWithdrawal = Math.min(remaining, available);
        withdrawals.ira_traditional = (withdrawals.ira_traditional || 0) + iraWithdrawal;
        remaining -= iraWithdrawal;
      }

      // 401(k)
      if (remaining > 0 && accounts['401k_traditional'] > 0) {
        const available = accounts['401k_traditional'] - (rmds['401k_traditional'] || 0);
        const k401Withdrawal = Math.min(remaining, available);
        withdrawals['401k_traditional'] = (withdrawals['401k_traditional'] || 0) + k401Withdrawal;
        remaining -= k401Withdrawal;
      }
    }

    // Strategy 3: Roth (only if allowed and necessary)
    if (remaining > 0 && options.allowRothWithdrawals) {
      if (accounts.ira_roth > 0) {
        const rothWithdrawal = Math.min(remaining, accounts.ira_roth);
        withdrawals.ira_roth = rothWithdrawal;
        remaining -= rothWithdrawal;
      }
    }

    return {
      withdrawals,
      qcdUsed,
      taxLossHarvested,
      shortfall: remaining,
    };
  }

  /**
   * Calculate income from withdrawals.
   */
  calculateIncome(sequence, otherIncome) {
    const { withdrawals, qcdUsed, taxLossHarvested } = sequence;

    // Taxable income from withdrawals
    const ordinaryIncome = 
      (withdrawals.ira_traditional || 0) +
      (withdrawals['401k_traditional'] || 0) -
      (qcdUsed || 0); // QCDs are not taxable

    // Capital gains from taxable accounts (assume 30% is gains)
    const taxableWithdrawal = withdrawals.taxable || 0;
    const capitalGains = Math.max(0, taxableWithdrawal * 0.3 - (taxLossHarvested || 0));

    // Roth withdrawals are tax-free
    const rothDistributions = withdrawals.ira_roth || 0;

    return {
      ordinaryIncome,
      longTermCapitalGains: capitalGains,
      qualifiedDividends: 0, // Separate calculation in full plan
      socialSecurity: otherIncome, // Simplified (assume all other income is SS)
      rothDistributions,
      municipalBondInterest: 0,
    };
  }

  /**
   * Optimize Roth conversion amount.
   */
  optimizeRothConversion(accounts, currentIncome, household, budget, currentTaxes) {
    if (budget === 0 || accounts.ira_traditional === 0) {
      return { amount: 0, additionalTax: 0, benefit: null };
    }

    // Strategy: Fill current tax bracket up to next bracket threshold
    const currentMarginal = currentTaxes.marginalRate / 100;
    const nextBracketThreshold = this.getNextBracketThreshold(
      currentTaxes.taxableIncome,
      household.filingStatus
    );

    if (!nextBracketThreshold) {
      return { amount: 0, additionalTax: 0, benefit: null };
    }

    const roomInBracket = nextBracketThreshold - currentTaxes.taxableIncome;
    const conversionAmount = Math.min(budget, roomInBracket, accounts.ira_traditional);

    if (conversionAmount <= 0) {
      return { amount: 0, additionalTax: 0, benefit: null };
    }

    // Calculate tax on conversion
    const additionalTax = conversionAmount * currentMarginal;

    // Calculate benefit (future tax savings)
    const futureMarginalRate = 0.24; // Assume 24% future rate (conservative)
    const futureTaxSavings = conversionAmount * futureMarginalRate;
    const benefit = futureTaxSavings - additionalTax;

    return {
      amount: conversionAmount,
      additionalTax,
      benefit,
      breakEvenYears: additionalTax / (futureTaxSavings - additionalTax) || Infinity,
      recommendation: benefit > 0 ? 'Convert' : 'Skip',
    };
  }

  /**
   * Get next tax bracket threshold.
   */
  getNextBracketThreshold(currentIncome, filingStatus) {
    const brackets = this.taxCalculator.federalBrackets[filingStatus];
    
    for (let i = 0; i < brackets.length - 1; i++) {
      if (currentIncome < brackets[i + 1].threshold) {
        return brackets[i + 1].threshold;
      }
    }
    
    return null; // Already in top bracket
  }

  /**
   * Calculate efficiency score (0-100).
   */
  calculateEfficiencyScore(sequence, taxes) {
    let score = 100;

    // Penalty for leaving money in taxable when tax-deferred available
    // (Taxable is usually more efficient for growth)
    
    // Bonus for using QCDs
    if (sequence.qcdUsed > 0) {
      score += 10;
    }

    // Bonus for tax-loss harvesting
    if (sequence.taxLossHarvested > 0) {
      score += 5;
    }

    // Penalty for high effective rate
    if (taxes.effectiveRate > 25) {
      score -= (taxes.effectiveRate - 25) * 0.5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Simulate multi-year withdrawal strategy.
   */
  simulateMultiYear(accounts, needs, household, years = 30) {
    const results = [];
    let currentAccounts = { ...accounts };

    for (let year = 0; year < years; year++) {
      const age1 = household.age1 + year;
      const age2 = household.age2 !== null ? household.age2 + year : null;

      const yearResult = this.optimizeWithdrawals(
        currentAccounts,
        needs,
        { ...household, age1, age2 }
      );

      // Update account balances (simplified - no growth assumed)
      Object.keys(yearResult.withdrawals).forEach(accountType => {
        if (currentAccounts[accountType]) {
          currentAccounts[accountType] -= yearResult.withdrawals[accountType];
        }
      });

      // Apply Roth conversion
      if (yearResult.rothConversion.amount > 0) {
        currentAccounts.ira_traditional -= yearResult.rothConversion.amount;
        currentAccounts.ira_roth = (currentAccounts.ira_roth || 0) + yearResult.rothConversion.amount;
      }

      results.push({
        year: year + 1,
        age1,
        age2,
        ...yearResult,
        accountBalances: { ...currentAccounts },
      });

      // Stop if accounts depleted
      if (Object.values(currentAccounts).every(bal => bal <= 0)) {
        break;
      }
    }

    return results;
  }
}

export default WithdrawalSequencer;
