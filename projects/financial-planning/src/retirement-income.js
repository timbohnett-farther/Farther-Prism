/**
 * Retirement Income & Withdrawal Strategy Engine
 * 
 * Tax-optimized withdrawal strategies, Social Security timing,
 * RMD calculations, Roth conversion analysis
 * 
 * @module retirement-income
 */

/**
 * Calculate optimal withdrawal strategy across account types
 */
export function calculateOptimalWithdrawals({
  annualNeed,
  accounts, // { taxable, taxDeferred, taxFree }
  age,
  taxBracket,
  stateTaxRate = 0,
  socialSecurity = 0,
  pension = 0,
}) {
  const federalRate = taxBracket / 100;
  const combinedTaxRate = federalRate + stateTaxRate;
  
  // Calculate income needed from portfolio
  const portfolioNeed = annualNeed - socialSecurity - pension;
  
  let remaining = portfolioNeed;
  const withdrawals = {
    taxable: 0,
    taxDeferred: 0,
    taxFree: 0,
    totalGross: 0,
    totalNet: 0,
    taxesOwed: 0,
  };
  
  // Strategy: Taxable first (lowest tax impact), then tax-deferred, then tax-free last
  
  // 1. Withdraw from taxable accounts (only pay capital gains tax)
  const capitalGainsRate = 0.15; // Assume 15% federal + state
  const taxableAvailable = accounts.taxable || 0;
  if (remaining > 0 && taxableAvailable > 0) {
    const withdrawal = Math.min(remaining, taxableAvailable);
    withdrawals.taxable = withdrawal;
    withdrawals.taxesOwed += withdrawal * capitalGainsRate;
    remaining -= withdrawal;
  }
  
  // 2. Withdraw from tax-deferred (Traditional IRA/401k) - ordinary income tax
  const taxDeferredAvailable = accounts.taxDeferred || 0;
  if (remaining > 0 && taxDeferredAvailable > 0) {
    // Calculate how much to withdraw to stay in current tax bracket
    const withdrawal = Math.min(remaining, taxDeferredAvailable);
    withdrawals.taxDeferred = withdrawal;
    withdrawals.taxesOwed += withdrawal * combinedTaxRate;
    remaining -= withdrawal;
  }
  
  // 3. Withdraw from tax-free (Roth) - no tax
  const taxFreeAvailable = accounts.taxFree || 0;
  if (remaining > 0 && taxFreeAvailable > 0) {
    const withdrawal = Math.min(remaining, taxFreeAvailable);
    withdrawals.taxFree = withdrawal;
    remaining -= withdrawal;
  }
  
  withdrawals.totalGross = withdrawals.taxable + withdrawals.taxDeferred + withdrawals.taxFree;
  withdrawals.totalNet = withdrawals.totalGross - withdrawals.taxesOwed;
  withdrawals.shortfall = remaining;
  
  return withdrawals;
}

/**
 * Calculate Required Minimum Distributions (RMDs)
 */
export function calculateRMD(age, accountBalance) {
  // IRS Uniform Lifetime Table
  const lifetimeFactors = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
    78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
    90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  };
  
  if (age < 72) {
    return {
      age,
      rmdRequired: false,
      rmdAmount: 0,
      message: 'RMDs not required until age 72',
    };
  }
  
  const factor = lifetimeFactors[age] || lifetimeFactors[95];
  const rmdAmount = accountBalance / factor;
  
  return {
    age,
    rmdRequired: true,
    rmdAmount: Math.round(rmdAmount),
    lifetimeFactor: factor,
    accountBalance,
    taxImplication: 'RMD is taxed as ordinary income',
  };
}

/**
 * Analyze Roth conversion opportunity
 */
export function analyzeRothConversion({
  traditionalIRABalance,
  currentAge,
  retirementAge,
  currentTaxBracket,
  expectedRetirementTaxBracket,
  conversionAmount,
  yearsToGrow = retirementAge - currentAge,
  expectedReturn = 0.07,
}) {
  // Calculate tax cost of conversion now
  const conversionTaxCost = conversionAmount * (currentTaxBracket / 100);
  
  // Calculate future value of converted amount (tax-free growth)
  const futureValueRoth = conversionAmount * Math.pow(1 + expectedReturn, yearsToGrow);
  
  // Calculate future value if NOT converted (taxed at withdrawal)
  const futureValueTraditional = conversionAmount * Math.pow(1 + expectedReturn, yearsToGrow);
  const futureTaxCost = futureValueTraditional * (expectedRetirementTaxBracket / 100);
  const futureValueAfterTax = futureValueTraditional - futureTaxCost;
  
  // Calculate tax savings
  const taxSavings = futureTaxCost - conversionTaxCost;
  const netBenefit = futureValueRoth - futureValueAfterTax;
  
  // Calculate breakeven point
  const taxDifference = (expectedRetirementTaxBracket - currentTaxBracket) / 100;
  const isWorthwhile = expectedRetirementTaxBracket > currentTaxBracket;
  
  return {
    conversionAmount,
    conversionTaxCost: Math.round(conversionTaxCost),
    currentTaxBracket,
    expectedRetirementTaxBracket,
    yearsToGrow,
    futureValueRoth: Math.round(futureValueRoth),
    futureValueAfterTax: Math.round(futureValueAfterTax),
    taxSavings: Math.round(taxSavings),
    netBenefit: Math.round(netBenefit),
    isWorthwhile,
    recommendation: isWorthwhile
      ? `Convert now. Save $${Math.round(taxSavings).toLocaleString()} in future taxes.`
      : `Wait. Current tax rate (${currentTaxBracket}%) is higher than expected retirement rate (${expectedRetirementTaxBracket}%).`,
  };
}

/**
 * Calculate optimal Social Security claiming age
 */
export function optimizeSocialSecurityClaiming({
  primaryInsuranceAmount, // Full retirement age benefit
  currentAge,
  fullRetirementAge = 67,
  lifeExpectancy = 85,
  spouseBenefit = 0,
  considerSpousalBenefits = false,
}) {
  const claimingAges = [62, fullRetirementAge, 70];
  const scenarios = [];
  
  claimingAges.forEach(claimAge => {
    // Calculate benefit amount based on claiming age
    let benefit = primaryInsuranceAmount;
    
    if (claimAge < fullRetirementAge) {
      // Early claiming penalty: ~6.7% per year before FRA
      const yearsEarly = fullRetirementAge - claimAge;
      const reductionFactor = 1 - (yearsEarly * 0.067);
      benefit = primaryInsuranceAmount * reductionFactor;
    } else if (claimAge > fullRetirementAge) {
      // Delayed retirement credits: 8% per year after FRA
      const yearsDelayed = claimAge - fullRetirementAge;
      benefit = primaryInsuranceAmount * (1 + yearsDelayed * 0.08);
    }
    
    // Calculate lifetime benefits
    const yearsReceiving = lifeExpectancy - claimAge;
    const lifetimeBenefit = benefit * 12 * yearsReceiving;
    
    // Calculate breakeven age vs claiming at 62
    const earlyBenefit = primaryInsuranceAmount * (1 - (fullRetirementAge - 62) * 0.067);
    const monthlyDifference = benefit - earlyBenefit;
    const breakevenAge = claimAge + ((earlyBenefit * 12 * (claimAge - 62)) / (monthlyDifference * 12));
    
    scenarios.push({
      claimingAge: claimAge,
      monthlyBenefit: Math.round(benefit),
      annualBenefit: Math.round(benefit * 12),
      lifetimeBenefit: Math.round(lifetimeBenefit),
      breakevenAge: claimAge === 62 ? claimAge : Math.round(breakevenAge),
      yearsReceiving,
    });
  });
  
  // Find optimal age (highest lifetime benefit)
  scenarios.sort((a, b) => b.lifetimeBenefit - a.lifetimeBenefit);
  const optimal = scenarios[0];
  
  return {
    primaryInsuranceAmount,
    fullRetirementAge,
    lifeExpectancy,
    scenarios,
    optimalAge: optimal.claimingAge,
    recommendation: `Claim at age ${optimal.claimingAge} for maximum lifetime benefit of $${optimal.lifetimeBenefit.toLocaleString()}`,
    considerations: [
      'Health status and family longevity',
      'Need for income before full retirement age',
      'Impact on spousal benefits',
      'Tax implications of higher income',
    ],
  };
}

/**
 * Calculate safe withdrawal rate using dynamic approach
 */
export function calculateSafeWithdrawalRate({
  portfolioValue,
  age,
  retirementAge,
  lifeExpectancy = 95,
  currentMarketCondition = 'normal', // 'bull', 'normal', 'bear'
  portfolioAllocation, // { stocks: 60, bonds: 40 }
}) {
  const yearsInRetirement = lifeExpectancy - age;
  
  // Base rate (traditional 4% rule)
  let baseRate = 0.04;
  
  // Adjust for age (longer retirement = lower rate)
  if (yearsInRetirement > 30) {
    baseRate = 0.035; // More conservative for very long retirement
  } else if (yearsInRetirement < 20) {
    baseRate = 0.045; // Can be slightly more aggressive
  }
  
  // Adjust for market conditions
  const marketAdjustments = {
    bull: 1.05,    // Can take slightly more in good markets
    normal: 1.0,
    bear: 0.85,    // Be more conservative in down markets
  };
  baseRate *= marketAdjustments[currentMarketCondition];
  
  // Adjust for portfolio allocation (more stocks = can sustain higher withdrawal)
  const stockAllocation = portfolioAllocation.stocks / 100;
  if (stockAllocation > 0.70) {
    baseRate *= 1.05;
  } else if (stockAllocation < 0.50) {
    baseRate *= 0.95;
  }
  
  const recommendedAnnualWithdrawal = portfolioValue * baseRate;
  
  return {
    portfolioValue,
    safeWithdrawalRate: (baseRate * 100).toFixed(2) + '%',
    recommendedAnnualWithdrawal: Math.round(recommendedAnnualWithdrawal),
    recommendedMonthlyIncome: Math.round(recommendedAnnualWithdrawal / 12),
    yearsInRetirement,
    marketCondition: currentMarketCondition,
    portfolioAllocation,
    methodology: 'Dynamic withdrawal strategy based on age, market conditions, and allocation',
  };
}

/**
 * Project retirement income over time
 */
export function projectRetirementIncome({
  currentAge,
  retirementAge,
  lifeExpectancy = 95,
  initialPortfolio,
  annualWithdrawal,
  socialSecurityAge,
  socialSecurityBenefit,
  pensionBenefit = 0,
  inflationRate = 0.03,
  portfolioReturn = 0.06,
  withdrawalStrategy = 'constant', // 'constant', 'inflation-adjusted', 'dynamic'
}) {
  const projections = [];
  let portfolioValue = initialPortfolio;
  let age = currentAge;
  
  while (age <= lifeExpectancy) {
    const isRetired = age >= retirementAge;
    const receivingSS = age >= socialSecurityAge;
    
    // Calculate income sources
    const ssIncome = receivingSS ? socialSecurityBenefit : 0;
    const pensionIncome = isRetired ? pensionBenefit : 0;
    
    // Calculate withdrawal needed
    let portfolioWithdrawal = 0;
    if (isRetired) {
      if (withdrawalStrategy === 'constant') {
        portfolioWithdrawal = annualWithdrawal;
      } else if (withdrawalStrategy === 'inflation-adjusted') {
        const yearsRetired = age - retirementAge;
        portfolioWithdrawal = annualWithdrawal * Math.pow(1 + inflationRate, yearsRetired);
      } else if (withdrawalStrategy === 'dynamic') {
        // 4% of current portfolio value
        portfolioWithdrawal = portfolioValue * 0.04;
      }
    }
    
    // Update portfolio
    const portfolioGrowth = portfolioValue * portfolioReturn;
    portfolioValue = portfolioValue + portfolioGrowth - portfolioWithdrawal;
    
    projections.push({
      age,
      portfolioValue: Math.round(portfolioValue),
      portfolioWithdrawal: Math.round(portfolioWithdrawal),
      socialSecurityIncome: Math.round(ssIncome),
      pensionIncome: Math.round(pensionIncome),
      totalIncome: Math.round(portfolioWithdrawal + ssIncome + pensionIncome),
      isRetired,
    });
    
    age++;
    
    // Stop if portfolio depleted
    if (portfolioValue <= 0) {
      projections[projections.length - 1].portfolioDepletedAge = age;
      break;
    }
  }
  
  return {
    projections,
    portfolioLastsUntilAge: portfolioValue > 0 ? lifeExpectancy : projections[projections.length - 1].age,
    finalPortfolioValue: Math.round(portfolioValue),
    successful: portfolioValue > 0,
  };
}
