/**
 * Comprehensive Financial Plan Generator
 * 
 * Orchestrates all planning modules to create complete financial plans
 * Integrates: Cash flow, Goals, Retirement, Tax optimization, Monte Carlo
 * 
 * @module plan-generator
 */

import { calculateMonthlyCashFlow, projectCashFlows, analyzeSpendingPatterns, calculateDebtPayoff, calculateEmergencyFund } from './cashflow.js';
import { calculateRetirementNeed, assessRetirementReadiness, calculateEducationFunding, calculateMajorPurchase, prioritizeGoals, calculateLegacyGoal } from './goals.js';
import { calculateOptimalWithdrawals, calculateRMD, analyzeRothConversion, optimizeSocialSecurityClaiming, calculateSafeWithdrawalRate, projectRetirementIncome } from './retirement-income.js';
import { runMonteCarlo } from '../../risk-engine/src/monte-carlo.js';

/**
 * Generate comprehensive financial plan
 */
export async function generateComprehensivePlan(clientData) {
  const startTime = Date.now();
  
  const plan = {
    client: {
      name: `${clientData.personal.firstName} ${clientData.personal.lastName}`,
      age: clientData.personal.age,
      retirementAge: clientData.personal.retirementAge,
      generatedAt: new Date().toISOString(),
    },
    
    // 1. Current Financial Position
    currentPosition: analyzeCurrentPosition(clientData),
    
    // 2. Cash Flow Analysis
    cashFlow: analyzeCashFlow(clientData),
    
    // 3. Goal Analysis
    goals: analyzeGoals(clientData),
    
    // 4. Retirement Planning
    retirement: analyzeRetirement(clientData),
    
    // 5. Tax Optimization
    taxOptimization: analyzeTaxOptimization(clientData),
    
    // 6. Risk Analysis (Monte Carlo)
    riskAnalysis: await analyzeRisk(clientData),
    
    // 7. Action Items & Recommendations
    recommendations: generateRecommendations(clientData),
    
    // Execution time
    executionTimeMs: Date.now() - startTime,
  };
  
  return plan;
}

/**
 * Analyze current financial position
 */
function analyzeCurrentPosition(clientData) {
  // Calculate total assets
  const totalAssets = 
    sumAssets(clientData.assets.taxable) +
    sumAssets(clientData.assets.taxDeferred) +
    sumAssets(clientData.assets.taxFree) +
    sumAssets(clientData.assets.realEstate) +
    sumAssets(clientData.assets.business) +
    (clientData.assets.cash || 0);
  
  // Calculate total liabilities
  const totalLiabilities = 
    sumLiabilities(clientData.liabilities.mortgage) +
    sumLiabilities(clientData.liabilities.studentLoans) +
    sumLiabilities(clientData.liabilities.autoLoans) +
    sumLiabilities(clientData.liabilities.creditCards) +
    sumLiabilities(clientData.liabilities.other);
  
  const netWorth = totalAssets - totalLiabilities;
  
  // Liquidity analysis
  const liquidAssets = 
    sumAssets(clientData.assets.taxable) +
    (clientData.assets.cash || 0);
  
  const monthlyExpenses = Object.values(clientData.expenses).reduce((sum, val) => sum + val, 0);
  const monthsOfLiquidReserves = liquidAssets / monthlyExpenses;
  
  return {
    totalAssets: Math.round(totalAssets),
    totalLiabilities: Math.round(totalLiabilities),
    netWorth: Math.round(netWorth),
    liquidAssets: Math.round(liquidAssets),
    monthsOfLiquidReserves: monthsOfLiquidReserves.toFixed(1),
    assetAllocation: {
      taxable: sumAssets(clientData.assets.taxable),
      taxDeferred: sumAssets(clientData.assets.taxDeferred),
      taxFree: sumAssets(clientData.assets.taxFree),
      realEstate: sumAssets(clientData.assets.realEstate),
      business: sumAssets(clientData.assets.business),
      cash: clientData.assets.cash || 0,
    },
    liabilityBreakdown: {
      mortgage: sumLiabilities(clientData.liabilities.mortgage),
      studentLoans: sumLiabilities(clientData.liabilities.studentLoans),
      autoLoans: sumLiabilities(clientData.liabilities.autoLoans),
      creditCards: sumLiabilities(clientData.liabilities.creditCards),
      other: sumLiabilities(clientData.liabilities.other),
    },
  };
}

/**
 * Analyze cash flow
 */
function analyzeCashFlow(clientData) {
  const monthlyIncome = clientData.income.salary / 12 + 
                        (clientData.income.bonus || 0) / 12 +
                        (clientData.income.otherIncome || 0) / 12;
  
  const monthlyExpenses = Object.values(clientData.expenses).reduce((sum, val) => sum + val, 0);
  
  const currentCashFlow = calculateMonthlyCashFlow(
    { monthly: monthlyIncome },
    clientData.expenses
  );
  
  const spendingAnalysis = analyzeSpendingPatterns(clientData.expenses);
  
  const emergencyFund = calculateEmergencyFund(
    monthlyExpenses,
    clientData.employmentStability || 'stable'
  );
  
  // Project cash flows to retirement
  const cashFlowProjections = projectCashFlows({
    currentIncome: monthlyIncome * 12,
    currentExpenses: monthlyExpenses * 12,
    years: clientData.personal.retirementAge - clientData.personal.age,
    currentAge: clientData.personal.age,
    retirementAge: clientData.personal.retirementAge,
  });
  
  return {
    current: currentCashFlow,
    spending: spendingAnalysis,
    emergencyFund,
    projections: cashFlowProjections,
  };
}

/**
 * Analyze goals
 */
function analyzeGoals(clientData) {
  const goals = [];
  
  // Retirement goal
  const retirementNeed = calculateRetirementNeed({
    currentAge: clientData.personal.age,
    retirementAge: clientData.personal.retirementAge,
    currentIncome: clientData.income.salary,
    socialSecurityBenefit: clientData.income.socialSecurity || 0,
    pensionBenefit: clientData.income.pension || 0,
  });
  
  const currentRetirementSavings = 
    sumAssets(clientData.assets.taxDeferred) +
    sumAssets(clientData.assets.taxFree);
  
  const retirementReadiness = assessRetirementReadiness({
    currentSavings: currentRetirementSavings,
    currentAge: clientData.personal.age,
    retirementAge: clientData.personal.retirementAge,
    monthlyContribution: (clientData.income.salary * 0.10) / 12, // Assume 10% contribution
    retirementNeed: retirementNeed.requiredPortfolioValue,
  });
  
  goals.push({
    type: 'retirement',
    ...retirementReadiness,
  });
  
  // Education goals
  if (clientData.goals && clientData.goals.education) {
    clientData.goals.education.forEach(eduGoal => {
      const educationAnalysis = calculateEducationFunding({
        childAge: eduGoal.childAge,
        currentSavings: eduGoal.currentSavings || 0,
        monthlyContribution: eduGoal.monthlyContribution || 0,
      });
      goals.push({
        type: 'education',
        childName: eduGoal.childName,
        ...educationAnalysis,
      });
    });
  }
  
  // Major purchases
  if (clientData.goals && clientData.goals.majorPurchases) {
    clientData.goals.majorPurchases.forEach(purchase => {
      const purchaseAnalysis = calculateMajorPurchase({
        goalName: purchase.name,
        targetAmount: purchase.targetAmount,
        yearsUntilPurchase: purchase.yearsUntil,
        currentSavings: purchase.currentSavings || 0,
        monthlyContribution: purchase.monthlyContribution || 0,
      });
      goals.push({
        type: 'major_purchase',
        ...purchaseAnalysis,
      });
    });
  }
  
  // Prioritize all goals
  const monthlyIncome = clientData.income.salary / 12;
  const monthlyExpenses = Object.values(clientData.expenses).reduce((sum, val) => sum + val, 0);
  const availableSavings = monthlyIncome - monthlyExpenses;
  
  const prioritization = prioritizeGoals(goals, availableSavings);
  
  return {
    goals,
    prioritization,
  };
}

/**
 * Analyze retirement
 */
function analyzeRetirement(clientData) {
  const portfolioValue = 
    sumAssets(clientData.assets.taxable) +
    sumAssets(clientData.assets.taxDeferred) +
    sumAssets(clientData.assets.taxFree);
  
  const safeWithdrawal = calculateSafeWithdrawalRate({
    portfolioValue,
    age: clientData.personal.age,
    retirementAge: clientData.personal.retirementAge,
    portfolioAllocation: { stocks: 60, bonds: 40 }, // Default allocation
  });
  
  const socialSecurity = optimizeSocialSecurityClaiming({
    primaryInsuranceAmount: clientData.income.socialSecurity || 2500,
    currentAge: clientData.personal.age,
  });
  
  const incomeProjection = projectRetirementIncome({
    currentAge: clientData.personal.age,
    retirementAge: clientData.personal.retirementAge,
    initialPortfolio: portfolioValue,
    annualWithdrawal: safeWithdrawal.recommendedAnnualWithdrawal,
    socialSecurityAge: socialSecurity.optimalAge,
    socialSecurityBenefit: socialSecurity.scenarios[0].annualBenefit,
  });
  
  return {
    safeWithdrawal,
    socialSecurity,
    incomeProjection,
  };
}

/**
 * Analyze tax optimization opportunities
 */
function analyzeTaxOptimization(clientData) {
  const opportunities = [];
  
  // Roth conversion analysis
  const traditionalIRA = sumAssets(clientData.assets.taxDeferred);
  if (traditionalIRA > 50000) {
    const rothAnalysis = analyzeRothConversion({
      traditionalIRABalance: traditionalIRA,
      currentAge: clientData.personal.age,
      retirementAge: clientData.personal.retirementAge,
      currentTaxBracket: 24, // Assume 24% bracket
      expectedRetirementTaxBracket: 22,
      conversionAmount: 50000, // Convert $50k
    });
    
    opportunities.push({
      type: 'roth_conversion',
      ...rothAnalysis,
    });
  }
  
  // Tax-loss harvesting (if taxable account exists)
  const taxableAssets = sumAssets(clientData.assets.taxable);
  if (taxableAssets > 100000) {
    opportunities.push({
      type: 'tax_loss_harvesting',
      potential: 'Automate tax-loss harvesting to reduce capital gains taxes',
      estimatedSavings: taxableAssets * 0.01, // 1% of portfolio value annually
    });
  }
  
  return opportunities;
}

/**
 * Run Monte Carlo risk analysis
 */
async function analyzeRisk(clientData) {
  const portfolioValue = 
    sumAssets(clientData.assets.taxable) +
    sumAssets(clientData.assets.taxDeferred) +
    sumAssets(clientData.assets.taxFree);
  
  const yearsToRetirement = clientData.personal.retirementAge - clientData.personal.age;
  const retirementYears = 30; // Assume 30 years in retirement
  
  const monthlyExpenses = Object.values(clientData.expenses).reduce((sum, val) => sum + val, 0);
  const annualExpenses = monthlyExpenses * 12;
  
  const monteCarloResults = runMonteCarlo({
    initialValue: portfolioValue,
    expectedReturn: 0.07,
    volatility: 0.15,
    years: yearsToRetirement + retirementYears,
    annualWithdrawal: annualExpenses * 0.8, // 80% replacement ratio
    numSimulations: 10000,
  });
  
  return monteCarloResults;
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(clientData) {
  const recommendations = [];
  
  // Emergency fund check
  const liquidAssets = sumAssets(clientData.assets.taxable) + (clientData.assets.cash || 0);
  const monthlyExpenses = Object.values(clientData.expenses).reduce((sum, val) => sum + val, 0);
  const emergencyFundMonths = liquidAssets / monthlyExpenses;
  
  if (emergencyFundMonths < 3) {
    recommendations.push({
      priority: 'critical',
      category: 'emergency_fund',
      title: 'Build Emergency Fund',
      description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses in liquid assets. Build to 6 months ($${(monthlyExpenses * 6).toLocaleString()}).`,
      actionSteps: [
        'Open high-yield savings account',
        `Set up automatic transfer of $${Math.round((monthlyExpenses * 6 - liquidAssets) / 12).toLocaleString()}/month`,
        'Complete in 12 months',
      ],
    });
  }
  
  // High-interest debt
  const creditCards = sumLiabilities(clientData.liabilities.creditCards);
  if (creditCards > 0) {
    recommendations.push({
      priority: 'high',
      category: 'debt',
      title: 'Pay Off High-Interest Debt',
      description: `You have $${creditCards.toLocaleString()} in credit card debt. This is likely costing you 18-24% annually.`,
      actionSteps: [
        'Stop using credit cards for new purchases',
        'Use avalanche method (highest rate first)',
        'Consider balance transfer to 0% APR card',
      ],
    });
  }
  
  // Retirement savings
  const retirementSavings = 
    sumAssets(clientData.assets.taxDeferred) +
    sumAssets(clientData.assets.taxFree);
  
  const targetSavings = clientData.income.salary * (clientData.personal.age - 25); // Rule of thumb
  if (retirementSavings < targetSavings) {
    recommendations.push({
      priority: 'high',
      category: 'retirement',
      title: 'Increase Retirement Contributions',
      description: `Target savings for age ${clientData.personal.age} is $${targetSavings.toLocaleString()}. You have $${retirementSavings.toLocaleString()}.`,
      actionSteps: [
        'Increase 401(k) contribution by 1-2% per year',
        'Maximize employer match first',
        'Consider Roth IRA ($7,000/year)',
      ],
    });
  }
  
  // Tax optimization
  if (retirementSavings > 100000 && clientData.taxSituation && clientData.taxSituation.federalBracket > 22) {
    recommendations.push({
      priority: 'medium',
      category: 'tax',
      title: 'Implement Tax Optimization Strategy',
      description: 'Multiple opportunities to reduce lifetime tax burden',
      actionSteps: [
        'Consider Roth conversion in low-income years',
        'Implement tax-loss harvesting',
        'Review asset location (tax-efficient placement)',
      ],
    });
  }
  
  return recommendations;
}

// Helper functions
function sumAssets(assets) {
  if (!assets) return 0;
  if (Array.isArray(assets)) {
    return assets.reduce((sum, asset) => sum + (asset.value || asset.balance || 0), 0);
  }
  return assets.value || assets.balance || 0;
}

function sumLiabilities(liabilities) {
  if (!liabilities) return 0;
  if (Array.isArray(liabilities)) {
    return liabilities.reduce((sum, liability) => sum + (liability.balance || 0), 0);
  }
  return liabilities.balance || 0;
}
