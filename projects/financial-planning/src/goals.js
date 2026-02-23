/**
 * Goal Planning Engine
 * 
 * Retirement planning, education funding, major purchases, legacy goals
 * Integrates with Monte Carlo engine for probability analysis
 * 
 * @module goals
 */

/**
 * Calculate retirement savings need
 */
export function calculateRetirementNeed({
  currentAge,
  retirementAge,
  lifeExpectancy = 95,
  currentIncome,
  replacementRatio = 0.80, // 80% of pre-retirement income
  inflationRate = 0.03,
  socialSecurityBenefit = 0,
  pensionBenefit = 0,
  otherIncome = 0,
}) {
  const yearsToRetirement = retirementAge - currentAge;
  const yearsInRetirement = lifeExpectancy - retirementAge;
  
  // Calculate future income need (adjusted for inflation)
  const futureIncomeNeed = currentIncome * replacementRatio * Math.pow(1 + inflationRate, yearsToRetirement);
  
  // Subtract guaranteed income sources
  const incomeGap = futureIncomeNeed - socialSecurityBenefit - pensionBenefit - otherIncome;
  
  // Calculate required portfolio value using 4% rule (adjusted)
  const withdrawalRate = 0.04;
  const requiredPortfolioValue = incomeGap / withdrawalRate;
  
  // Calculate total savings needed over retirement period (present value)
  const totalNeeded = incomeGap * yearsInRetirement / Math.pow(1 + inflationRate, yearsInRetirement / 2);
  
  return {
    yearsToRetirement,
    yearsInRetirement,
    annualIncomeNeed: Math.round(futureIncomeNeed),
    guaranteedIncome: Math.round(socialSecurityBenefit + pensionBenefit + otherIncome),
    annualIncomeGap: Math.round(incomeGap),
    requiredPortfolioValue: Math.round(requiredPortfolioValue),
    withdrawalRate: withdrawalRate * 100,
    totalLifetimeNeed: Math.round(totalNeeded),
  };
}

/**
 * Calculate retirement savings progress
 */
export function assessRetirementReadiness({
  currentSavings,
  currentAge,
  retirementAge,
  monthlyContribution,
  employerMatch = 0,
  expectedReturn = 0.07,
  retirementNeed,
}) {
  const yearsToRetirement = retirementAge - currentAge;
  
  // Calculate future value of current savings
  const fvCurrentSavings = currentSavings * Math.pow(1 + expectedReturn, yearsToRetirement);
  
  // Calculate future value of contributions (annuity)
  const monthlyRate = expectedReturn / 12;
  const months = yearsToRetirement * 12;
  const totalMonthlyContribution = monthlyContribution + employerMatch;
  
  const fvContributions = totalMonthlyContribution * 
    ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  
  const projectedPortfolio = fvCurrentSavings + fvContributions;
  const savingsGap = retirementNeed - projectedPortfolio;
  
  // Calculate required monthly contribution to close gap
  let requiredMonthlyContribution = 0;
  if (savingsGap > 0) {
    requiredMonthlyContribution = (savingsGap * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
  }
  
  return {
    currentSavings,
    projectedPortfolio: Math.round(projectedPortfolio),
    retirementNeed,
    savingsGap: Math.round(savingsGap),
    onTrack: savingsGap <= 0,
    percentFunded: Math.round((projectedPortfolio / retirementNeed) * 100),
    currentMonthlyContribution: totalMonthlyContribution,
    requiredMonthlyContribution: Math.round(requiredMonthlyContribution),
    additionalMonthlyNeeded: Math.round(Math.max(0, requiredMonthlyContribution - totalMonthlyContribution)),
  };
}

/**
 * Calculate education funding need (529 planning)
 */
export function calculateEducationFunding({
  childAge,
  yearsToCollege = 18 - childAge,
  currentCollegeCost = 30000, // Annual cost
  yearsInCollege = 4,
  collegeCostInflation = 0.05, // Higher than general inflation
  currentSavings = 0,
  monthlyContribution = 0,
  expectedReturn = 0.06,
}) {
  // Calculate future college cost
  const futureAnnualCost = currentCollegeCost * Math.pow(1 + collegeCostInflation, yearsToCollege);
  
  // Calculate total 4-year cost (mid-point of college years)
  const totalCost = futureAnnualCost * yearsInCollege * Math.pow(1 + collegeCostInflation, yearsInCollege / 2);
  
  // Project current savings
  const fvCurrentSavings = currentSavings * Math.pow(1 + expectedReturn, yearsToCollege);
  
  // Project contributions
  const monthlyRate = expectedReturn / 12;
  const months = yearsToCollege * 12;
  const fvContributions = monthlyContribution * 
    ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  
  const projectedSavings = fvCurrentSavings + fvContributions;
  const fundingGap = totalCost - projectedSavings;
  
  // Calculate required monthly contribution
  let requiredMonthlyContribution = 0;
  if (fundingGap > 0) {
    requiredMonthlyContribution = (fundingGap * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
  }
  
  return {
    childAge,
    yearsToCollege,
    currentCollegeCost,
    futureAnnualCost: Math.round(futureAnnualCost),
    totalFourYearCost: Math.round(totalCost),
    currentSavings,
    projectedSavings: Math.round(projectedSavings),
    fundingGap: Math.round(fundingGap),
    percentFunded: Math.round((projectedSavings / totalCost) * 100),
    currentMonthlyContribution: monthlyContribution,
    requiredMonthlyContribution: Math.round(requiredMonthlyContribution),
    additionalMonthlyNeeded: Math.round(Math.max(0, requiredMonthlyContribution - monthlyContribution)),
  };
}

/**
 * Calculate major purchase goal (home, car, vacation, etc.)
 */
export function calculateMajorPurchase({
  goalName,
  targetAmount,
  yearsUntilPurchase,
  currentSavings = 0,
  monthlyContribution = 0,
  expectedReturn = 0.03, // Conservative for short-term goals
}) {
  // Project savings
  const fvCurrentSavings = currentSavings * Math.pow(1 + expectedReturn, yearsUntilPurchase);
  
  const monthlyRate = expectedReturn / 12;
  const months = yearsUntilPurchase * 12;
  const fvContributions = monthlyContribution * 
    ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  
  const projectedSavings = fvCurrentSavings + fvContributions;
  const savingsGap = targetAmount - projectedSavings;
  
  // Calculate required monthly contribution
  let requiredMonthlyContribution = 0;
  if (savingsGap > 0) {
    requiredMonthlyContribution = (savingsGap * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
  }
  
  return {
    goalName,
    targetAmount,
    yearsUntilPurchase,
    currentSavings,
    projectedSavings: Math.round(projectedSavings),
    savingsGap: Math.round(savingsGap),
    onTrack: savingsGap <= 0,
    percentComplete: Math.round((projectedSavings / targetAmount) * 100),
    currentMonthlyContribution: monthlyContribution,
    requiredMonthlyContribution: Math.round(requiredMonthlyContribution),
    additionalMonthlyNeeded: Math.round(Math.max(0, requiredMonthlyContribution - monthlyContribution)),
  };
}

/**
 * Prioritize multiple goals based on urgency and importance
 */
export function prioritizeGoals(goals, availableMonthlySavings) {
  // Score each goal
  const scoredGoals = goals.map(goal => {
    let score = 0;
    
    // Urgency (time-sensitive goals get higher priority)
    if (goal.yearsToGoal <= 3) score += 50;
    else if (goal.yearsToGoal <= 7) score += 30;
    else if (goal.yearsToGoal <= 15) score += 10;
    
    // Importance (type-based)
    if (goal.type === 'emergency_fund') score += 100; // Highest priority
    else if (goal.type === 'debt_payoff' && goal.interestRate > 0.06) score += 80; // High-interest debt
    else if (goal.type === 'retirement') score += 60;
    else if (goal.type === 'education') score += 50;
    else if (goal.type === 'home_purchase') score += 40;
    else score += 20;
    
    // Funding status (underfunded goals need more attention)
    if (goal.percentFunded < 25) score += 30;
    else if (goal.percentFunded < 50) score += 20;
    else if (goal.percentFunded < 75) score += 10;
    
    return { ...goal, priorityScore: score };
  });
  
  // Sort by priority score
  scoredGoals.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Allocate available savings
  let remainingSavings = availableMonthlySavings;
  const allocations = scoredGoals.map(goal => {
    const needed = goal.requiredMonthlyContribution || goal.additionalMonthlyNeeded || 0;
    const allocated = Math.min(needed, remainingSavings);
    remainingSavings -= allocated;
    
    return {
      ...goal,
      allocatedMonthly: allocated,
      fullyFunded: allocated >= needed,
    };
  });
  
  return {
    allocations,
    totalAllocated: availableMonthlySavings - remainingSavings,
    unallocatedSavings: remainingSavings,
  };
}

/**
 * Calculate legacy/estate goal
 */
export function calculateLegacyGoal({
  targetLegacy,
  currentAge,
  lifeExpectancy = 95,
  currentNetWorth,
  expectedGrowthRate = 0.05,
  annualSpending = 0,
}) {
  const yearsRemaining = lifeExpectancy - currentAge;
  
  // Project net worth growth
  let projectedNetWorth = currentNetWorth;
  for (let year = 0; year < yearsRemaining; year++) {
    projectedNetWorth = (projectedNetWorth * (1 + expectedGrowthRate)) - annualSpending;
  }
  
  const legacyGap = targetLegacy - projectedNetWorth;
  
  return {
    targetLegacy,
    currentNetWorth,
    projectedNetWorth: Math.round(projectedNetWorth),
    legacyGap: Math.round(legacyGap),
    onTrack: legacyGap <= 0,
    percentToGoal: Math.round((projectedNetWorth / targetLegacy) * 100),
    yearsRemaining,
    recommendation: legacyGap > 0 
      ? 'Consider reducing spending or increasing portfolio growth rate'
      : 'On track to meet legacy goal',
  };
}
