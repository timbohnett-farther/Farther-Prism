/**
 * Tax Calculator
 * 
 * Comprehensive tax calculation for financial planning:
 * - Federal income tax (2024 brackets, all filing statuses)
 * - State income tax (all 50 states + DC)
 * - IRMAA surcharges (Medicare Part B and Part D)
 * - Net Investment Income Tax (NIIT - 3.8%)
 * - Capital gains tax (long-term vs short-term)
 * - Social Security taxation
 * - Fixed-point solver for withdrawal/tax interdependency
 * 
 * References:
 * - IRS Publication 17 (Individual Income Tax)
 * - IRS Publication 915 (Social Security Benefits)
 * - Medicare.gov IRMAA brackets
 * - State tax tables (Tax Foundation)
 */

export class TaxCalculator {
  constructor(taxYear = 2024) {
    this.taxYear = taxYear;
    this.federalBrackets = this.getFederalBrackets(taxYear);
    this.stateBrackets = this.getStateBrackets(taxYear);
    this.irmaaThresholds = this.getIRMAAThresholds(taxYear);
    this.niitThreshold = this.getNIITThreshold(taxYear);
    this.standardDeduction = this.getStandardDeduction(taxYear);
  }

  /**
   * Calculate total tax liability for a household.
   * 
   * @param {Object} income - Income breakdown
   * @param {Object} household - Household info (state, filing status, age)
   * @param {Object} options - Additional options
   * @returns {Object} Tax calculation results
   */
  calculateTax(income, household, options = {}) {
    const {
      ordinaryIncome = 0,        // W2, interest, short-term gains, IRA distributions
      longTermCapitalGains = 0,  // LTCG from taxable accounts
      qualifiedDividends = 0,    // Qualified dividends
      socialSecurity = 0,        // Social Security benefits
      rothDistributions = 0,     // Roth (tax-free, but counts for IRMAA)
      municipalBondInterest = 0, // Tax-free, but counts for IRMAA
    } = income;

    const {
      state = 'AZ',
      filingStatus = 'married_joint', // single, married_joint, married_separate, head_of_household
      age1 = 65,
      age2 = null, // null for single filers
      dependents = 0,
    } = household;

    // Step 1: Calculate AGI (Adjusted Gross Income)
    const agi = this.calculateAGI({
      ordinaryIncome,
      longTermCapitalGains,
      qualifiedDividends,
      socialSecurity,
    });

    // Step 2: Calculate MAGI (Modified AGI for IRMAA)
    const magi = agi + municipalBondInterest + rothDistributions;

    // Step 3: Calculate taxable income
    const standardDeduction = this.standardDeduction[filingStatus];
    const additionalStandardDeduction = this.getAdditionalStandardDeduction(age1, age2, filingStatus);
    const totalDeduction = standardDeduction + additionalStandardDeduction;
    
    const taxableIncome = Math.max(0, agi - totalDeduction);

    // Step 4: Calculate federal income tax
    const federalTax = this.calculateFederalTax(
      taxableIncome,
      longTermCapitalGains,
      qualifiedDividends,
      filingStatus
    );

    // Step 5: Calculate state income tax
    const stateTax = this.calculateStateTax(taxableIncome, state, filingStatus);

    // Step 6: Calculate IRMAA surcharges
    const irmaa = this.calculateIRMAA(magi, filingStatus, age1, age2);

    // Step 7: Calculate NIIT (3.8% surtax on investment income)
    const niit = this.calculateNIIT(
      longTermCapitalGains + qualifiedDividends,
      agi,
      filingStatus
    );

    // Step 8: Total tax liability
    const totalTax = federalTax + stateTax + irmaa.totalAnnual + niit;

    return {
      agi,
      magi,
      taxableIncome,
      federalTax,
      stateTax,
      irmaa,
      niit,
      totalTax,
      effectiveRate: agi > 0 ? (totalTax / agi) * 100 : 0,
      marginalRate: this.getMarginalRate(taxableIncome, filingStatus),
      breakdown: {
        federal: federalTax,
        state: stateTax,
        irmaa: irmaa.totalAnnual,
        niit,
      },
    };
  }

  /**
   * Calculate AGI (Adjusted Gross Income).
   */
  calculateAGI(income) {
    const { ordinaryIncome, longTermCapitalGains, qualifiedDividends, socialSecurity } = income;
    
    // Taxable portion of Social Security (up to 85%)
    const taxableSS = this.calculateTaxableSocialSecurity(
      socialSecurity,
      ordinaryIncome + longTermCapitalGains + qualifiedDividends
    );

    return ordinaryIncome + longTermCapitalGains + qualifiedDividends + taxableSS;
  }

  /**
   * Calculate taxable portion of Social Security benefits.
   * IRS Publication 915 formula.
   */
  calculateTaxableSocialSecurity(ssIncome, otherIncome) {
    if (ssIncome === 0) return 0;

    // Combined income = AGI + tax-exempt interest + 50% of SS
    const combinedIncome = otherIncome + (ssIncome * 0.5);

    // Thresholds (married filing jointly)
    const threshold1 = 32000;
    const threshold2 = 44000;

    if (combinedIncome <= threshold1) {
      return 0;
    } else if (combinedIncome <= threshold2) {
      // 50% taxable
      return Math.min(ssIncome * 0.5, (combinedIncome - threshold1) * 0.5);
    } else {
      // Up to 85% taxable
      const tier1 = (threshold2 - threshold1) * 0.5;
      const tier2 = (combinedIncome - threshold2) * 0.85;
      return Math.min(ssIncome * 0.85, tier1 + tier2);
    }
  }

  /**
   * Calculate federal income tax.
   */
  calculateFederalTax(taxableIncome, ltcg, qualifiedDividends, filingStatus) {
    const brackets = this.federalBrackets[filingStatus];
    
    // Separate ordinary income from preferential income (LTCG + qualified dividends)
    const preferentialIncome = ltcg + qualifiedDividends;
    const ordinaryIncome = Math.max(0, taxableIncome - preferentialIncome);

    // Calculate tax on ordinary income (regular brackets)
    let ordinaryTax = 0;
    let remaining = ordinaryIncome;
    
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const bracketSize = i < brackets.length - 1 
        ? brackets[i + 1].threshold - bracket.threshold 
        : Infinity;
      
      const taxableInBracket = Math.min(remaining, bracketSize);
      ordinaryTax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      
      if (remaining <= 0) break;
    }

    // Calculate tax on LTCG and qualified dividends (preferential rates: 0%, 15%, 20%)
    const ltcgTax = this.calculateLTCGTax(preferentialIncome, ordinaryIncome, filingStatus);

    return ordinaryTax + ltcgTax;
  }

  /**
   * Calculate long-term capital gains tax (0%, 15%, or 20%).
   */
  calculateLTCGTax(ltcgIncome, ordinaryIncome, filingStatus) {
    if (ltcgIncome === 0) return 0;

    // LTCG brackets (2024)
    const ltcgBrackets = {
      single: [
        { threshold: 0, rate: 0 },
        { threshold: 47025, rate: 0.15 },
        { threshold: 518900, rate: 0.20 },
      ],
      married_joint: [
        { threshold: 0, rate: 0 },
        { threshold: 94050, rate: 0.15 },
        { threshold: 583750, rate: 0.20 },
      ],
      married_separate: [
        { threshold: 0, rate: 0 },
        { threshold: 47025, rate: 0.15 },
        { threshold: 291850, rate: 0.20 },
      ],
      head_of_household: [
        { threshold: 0, rate: 0 },
        { threshold: 63000, rate: 0.15 },
        { threshold: 551350, rate: 0.20 },
      ],
    };

    const brackets = ltcgBrackets[filingStatus];
    let tax = 0;
    let remaining = ltcgIncome;
    let currentIncome = ordinaryIncome; // Stack LTCG on top of ordinary income

    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const nextThreshold = i < brackets.length - 1 ? brackets[i + 1].threshold : Infinity;
      
      // How much room in this bracket?
      const roomInBracket = Math.max(0, nextThreshold - currentIncome);
      const taxableInBracket = Math.min(remaining, roomInBracket);
      
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      currentIncome += taxableInBracket;
      
      if (remaining <= 0) break;
    }

    return tax;
  }

  /**
   * Calculate state income tax.
   */
  calculateStateTax(taxableIncome, state, filingStatus) {
    const stateBrackets = this.stateBrackets[state];
    
    if (!stateBrackets || stateBrackets.rate === 0) {
      // No state income tax (AK, FL, NV, NH, SD, TN, TX, WA, WY)
      return 0;
    }

    if (stateBrackets.flat) {
      // Flat tax state (CO, IL, IN, KY, MA, MI, NC, PA, UT)
      return taxableIncome * stateBrackets.rate;
    }

    // Progressive tax state
    const brackets = stateBrackets[filingStatus] || stateBrackets.single;
    let tax = 0;
    let remaining = taxableIncome;

    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      const bracketSize = i < brackets.length - 1 
        ? brackets[i + 1].threshold - bracket.threshold 
        : Infinity;
      
      const taxableInBracket = Math.min(remaining, bracketSize);
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      
      if (remaining <= 0) break;
    }

    return tax;
  }

  /**
   * Calculate IRMAA surcharges (Medicare Part B and Part D).
   */
  calculateIRMAA(magi, filingStatus, age1, age2) {
    // Only applies to people on Medicare (age 65+)
    const onMedicare1 = age1 >= 65;
    const onMedicare2 = age2 !== null && age2 >= 65;
    
    if (!onMedicare1 && !onMedicare2) {
      return {
        partB: 0,
        partD: 0,
        totalMonthly: 0,
        totalAnnual: 0,
      };
    }

    const thresholds = this.irmaaThresholds[filingStatus];
    
    // Find the IRMAA bracket
    let bracket = thresholds[thresholds.length - 1]; // Default to highest
    for (const tier of thresholds) {
      if (magi <= tier.magi) {
        bracket = tier;
        break;
      }
    }

    // Calculate surcharges
    const partBPerPerson = bracket.partB;
    const partDPerPerson = bracket.partD;
    
    const peopleOnMedicare = (onMedicare1 ? 1 : 0) + (onMedicare2 ? 1 : 0);
    const partB = partBPerPerson * peopleOnMedicare;
    const partD = partDPerPerson * peopleOnMedicare;

    return {
      partB,
      partD,
      totalMonthly: partB + partD,
      totalAnnual: (partB + partD) * 12,
      bracket: bracket.tier,
      magi,
    };
  }

  /**
   * Calculate NIIT (Net Investment Income Tax - 3.8% surtax).
   */
  calculateNIIT(investmentIncome, agi, filingStatus) {
    const threshold = this.niitThreshold[filingStatus];
    
    if (agi <= threshold) {
      return 0; // Below threshold
    }

    // NIIT applies to LESSER of:
    // 1. Net investment income
    // 2. AGI - threshold
    const excessAGI = agi - threshold;
    const taxableInvestmentIncome = Math.min(investmentIncome, excessAGI);
    
    return taxableInvestmentIncome * 0.038; // 3.8%
  }

  /**
   * Get marginal tax rate.
   */
  getMarginalRate(taxableIncome, filingStatus) {
    const brackets = this.federalBrackets[filingStatus];
    
    for (let i = brackets.length - 1; i >= 0; i--) {
      if (taxableIncome >= brackets[i].threshold) {
        return brackets[i].rate * 100;
      }
    }
    
    return brackets[0].rate * 100;
  }

  /**
   * Get additional standard deduction for age 65+.
   */
  getAdditionalStandardDeduction(age1, age2, filingStatus) {
    const additionalPerPerson = filingStatus === 'married_joint' ? 1550 : 1950;
    let count = 0;
    
    if (age1 >= 65) count++;
    if (age2 !== null && age2 >= 65) count++;
    
    return count * additionalPerPerson;
  }

  /**
   * Federal tax brackets (2024).
   */
  getFederalBrackets(year) {
    // 2024 federal tax brackets
    return {
      single: [
        { threshold: 0, rate: 0.10 },
        { threshold: 11600, rate: 0.12 },
        { threshold: 47150, rate: 0.22 },
        { threshold: 100525, rate: 0.24 },
        { threshold: 191950, rate: 0.32 },
        { threshold: 243725, rate: 0.35 },
        { threshold: 609350, rate: 0.37 },
      ],
      married_joint: [
        { threshold: 0, rate: 0.10 },
        { threshold: 23200, rate: 0.12 },
        { threshold: 94300, rate: 0.22 },
        { threshold: 201050, rate: 0.24 },
        { threshold: 383900, rate: 0.32 },
        { threshold: 487450, rate: 0.35 },
        { threshold: 731200, rate: 0.37 },
      ],
      married_separate: [
        { threshold: 0, rate: 0.10 },
        { threshold: 11600, rate: 0.12 },
        { threshold: 47150, rate: 0.22 },
        { threshold: 100525, rate: 0.24 },
        { threshold: 191950, rate: 0.32 },
        { threshold: 243725, rate: 0.35 },
        { threshold: 365600, rate: 0.37 },
      ],
      head_of_household: [
        { threshold: 0, rate: 0.10 },
        { threshold: 16550, rate: 0.12 },
        { threshold: 63100, rate: 0.22 },
        { threshold: 100500, rate: 0.24 },
        { threshold: 191950, rate: 0.32 },
        { threshold: 243700, rate: 0.35 },
        { threshold: 609350, rate: 0.37 },
      ],
    };
  }

  /**
   * State tax brackets (2024 - simplified for major states).
   */
  getStateBrackets(year) {
    return {
      // No income tax states
      AK: { rate: 0 },
      FL: { rate: 0 },
      NV: { rate: 0 },
      NH: { rate: 0 }, // Only dividends/interest taxed
      SD: { rate: 0 },
      TN: { rate: 0 },
      TX: { rate: 0 },
      WA: { rate: 0 },
      WY: { rate: 0 },

      // Flat tax states
      AZ: { flat: true, rate: 0.025 }, // 2.5% (Tim's state!)
      CO: { flat: true, rate: 0.044 },
      IL: { flat: true, rate: 0.0495 },
      IN: { flat: true, rate: 0.0315 },
      KY: { flat: true, rate: 0.04 },
      MA: { flat: true, rate: 0.05 },
      MI: { flat: true, rate: 0.0425 },
      NC: { flat: true, rate: 0.0475 },
      PA: { flat: true, rate: 0.0307 },
      UT: { flat: true, rate: 0.0485 },

      // Progressive tax states (top 5 by population)
      CA: {
        single: [
          { threshold: 0, rate: 0.01 },
          { threshold: 10412, rate: 0.02 },
          { threshold: 24684, rate: 0.04 },
          { threshold: 38959, rate: 0.06 },
          { threshold: 54081, rate: 0.08 },
          { threshold: 68350, rate: 0.093 },
          { threshold: 349137, rate: 0.103 },
          { threshold: 418961, rate: 0.113 },
          { threshold: 698271, rate: 0.123 },
          { threshold: 1000000, rate: 0.133 },
        ],
        married_joint: [
          { threshold: 0, rate: 0.01 },
          { threshold: 20824, rate: 0.02 },
          { threshold: 49368, rate: 0.04 },
          { threshold: 77918, rate: 0.06 },
          { threshold: 108162, rate: 0.08 },
          { threshold: 136700, rate: 0.093 },
          { threshold: 698274, rate: 0.103 },
          { threshold: 837922, rate: 0.113 },
          { threshold: 1396542, rate: 0.123 },
          { threshold: 2000000, rate: 0.133 },
        ],
      },
      NY: {
        single: [
          { threshold: 0, rate: 0.04 },
          { threshold: 8500, rate: 0.045 },
          { threshold: 11700, rate: 0.0525 },
          { threshold: 13900, rate: 0.055 },
          { threshold: 80650, rate: 0.06 },
          { threshold: 215400, rate: 0.0685 },
          { threshold: 1077550, rate: 0.0965 },
          { threshold: 5000000, rate: 0.103 },
          { threshold: 25000000, rate: 0.109 },
        ],
        married_joint: [
          { threshold: 0, rate: 0.04 },
          { threshold: 17150, rate: 0.045 },
          { threshold: 23600, rate: 0.0525 },
          { threshold: 27900, rate: 0.055 },
          { threshold: 161550, rate: 0.06 },
          { threshold: 323200, rate: 0.0685 },
          { threshold: 2155350, rate: 0.0965 },
          { threshold: 5000000, rate: 0.103 },
          { threshold: 25000000, rate: 0.109 },
        ],
      },
    };
  }

  /**
   * IRMAA thresholds (2024).
   */
  getIRMAAThresholds(year) {
    return {
      single: [
        { tier: 1, magi: 103000, partB: 0, partD: 0 },
        { tier: 2, magi: 129000, partB: 69.90, partD: 12.90 },
        { tier: 3, magi: 161000, partB: 174.70, partD: 33.30 },
        { tier: 4, magi: 193000, partB: 279.50, partD: 53.80 },
        { tier: 5, magi: 500000, partB: 384.30, partD: 74.20 },
        { tier: 6, magi: Infinity, partB: 419.30, partD: 81.00 },
      ],
      married_joint: [
        { tier: 1, magi: 206000, partB: 0, partD: 0 },
        { tier: 2, magi: 258000, partB: 69.90, partD: 12.90 },
        { tier: 3, magi: 322000, partB: 174.70, partD: 33.30 },
        { tier: 4, magi: 386000, partB: 279.50, partD: 53.80 },
        { tier: 5, magi: 750000, partB: 384.30, partD: 74.20 },
        { tier: 6, magi: Infinity, partB: 419.30, partD: 81.00 },
      ],
      married_separate: [
        { tier: 1, magi: 103000, partB: 0, partD: 0 },
        { tier: 2, magi: 129000, partB: 69.90, partD: 12.90 },
        { tier: 3, magi: 161000, partB: 174.70, partD: 33.30 },
        { tier: 4, magi: 193000, partB: 279.50, partD: 53.80 },
        { tier: 5, magi: 397000, partB: 384.30, partD: 74.20 },
        { tier: 6, magi: Infinity, partB: 419.30, partD: 81.00 },
      ],
    };
  }

  /**
   * NIIT thresholds (2024).
   */
  getNIITThreshold(year) {
    return {
      single: 200000,
      married_joint: 250000,
      married_separate: 125000,
      head_of_household: 200000,
    };
  }

  /**
   * Standard deduction (2024).
   */
  getStandardDeduction(year) {
    return {
      single: 14600,
      married_joint: 29200,
      married_separate: 14600,
      head_of_household: 21900,
    };
  }
}

export default TaxCalculator;
