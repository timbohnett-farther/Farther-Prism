/**
 * Cash Flow Analysis Engine
 * 
 * Analyzes client income, expenses, and projects future cash flows
 * Integrates with tax calculations and goal planning
 * 
 * @module cashflow
 */

/**
 * Calculate monthly surplus/deficit
 */
export function calculateMonthlyCashFlow(income, expenses) {
  const totalIncome = Object.values(income).reduce((sum, val) => sum + val, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
  
  return {
    totalIncome,
    totalExpenses,
    monthlySurplus: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
  };
}

/**
 * Project cash flows over time with inflation and income growth
 */
export function projectCashFlows({
  currentIncome,
  currentExpenses,
  years,
  inflationRate = 0.03,
  incomeGrowthRate = 0.025,
  retirementAge,
  currentAge,
  retirementIncome = 0,
  retirementExpenses = null, // If null, use 80% of pre-retirement
}) {
  const projections = [];
  
  for (let year = 0; year < years; year++) {
    const age = currentAge + year;
    const isRetired = age >= retirementAge;
    
    // Calculate income for this year
    const yearIncome = isRetired
      ? retirementIncome
      : currentIncome * Math.pow(1 + incomeGrowthRate, year);
    
    // Calculate expenses for this year
    const yearExpenses = isRetired && retirementExpenses !== null
      ? retirementExpenses * Math.pow(1 + inflationRate, year - (retirementAge - currentAge))
      : isRetired
      ? (currentExpenses * 0.8) * Math.pow(1 + inflationRate, year)
      : currentExpenses * Math.pow(1 + inflationRate, year);
    
    const surplus = yearIncome - yearExpenses;
    
    projections.push({
      year: year + 1,
      age,
      income: Math.round(yearIncome),
      expenses: Math.round(yearExpenses),
      surplus: Math.round(surplus),
      cumulativeSurplus: projections.length > 0
        ? projections[projections.length - 1].cumulativeSurplus + surplus
        : surplus,
      isRetired,
    });
  }
  
  return projections;
}

/**
 * Analyze spending patterns and identify optimization opportunities
 */
export function analyzeSpendingPatterns(expenses) {
  const total = Object.values(expenses).reduce((sum, val) => sum + val, 0);
  
  const categories = Object.entries(expenses).map(([category, amount]) => ({
    category,
    amount,
    percentage: (amount / total) * 100,
  }));
  
  // Sort by amount descending
  categories.sort((a, b) => b.amount - a.amount);
  
  // Identify areas for optimization
  const recommendations = [];
  
  // High discretionary spending
  const discretionary = expenses.discretionary || 0;
  if (discretionary > total * 0.20) {
    recommendations.push({
      category: 'discretionary',
      severity: 'medium',
      message: `Discretionary spending is ${((discretionary / total) * 100).toFixed(1)}% of total expenses. Consider reducing by 10-15% to increase savings.`,
      potentialSavings: discretionary * 0.125, // 12.5% reduction
    });
  }
  
  // High housing costs
  const housing = expenses.housing || 0;
  if (housing > total * 0.35) {
    recommendations.push({
      category: 'housing',
      severity: 'high',
      message: `Housing costs are ${((housing / total) * 100).toFixed(1)}% of expenses. Industry standard is 25-30%. Consider refinancing or downsizing.`,
      potentialSavings: housing - (total * 0.30),
    });
  }
  
  // Transportation costs
  const transportation = expenses.transportation || 0;
  if (transportation > total * 0.15) {
    recommendations.push({
      category: 'transportation',
      severity: 'medium',
      message: `Transportation is ${((transportation / total) * 100).toFixed(1)}% of expenses. Consider more efficient vehicle or carpooling.`,
      potentialSavings: transportation * 0.10,
    });
  }
  
  return {
    categories,
    totalMonthly: total,
    recommendations,
    potentialMonthlySavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
  };
}

/**
 * Calculate debt payoff strategies
 */
export function calculateDebtPayoff(liabilities, extraPayment = 0) {
  const debts = [];
  
  // Convert liabilities to debt array
  Object.entries(liabilities).forEach(([type, items]) => {
    if (Array.isArray(items)) {
      items.forEach(item => {
        debts.push({
          type,
          name: item.name || type,
          balance: item.balance,
          interestRate: item.interestRate,
          minimumPayment: item.minimumPayment || (item.balance * 0.02), // 2% min if not specified
        });
      });
    }
  });
  
  // Avalanche method (highest interest first)
  const avalanche = calculatePayoffSchedule(debts, extraPayment, 'avalanche');
  
  // Snowball method (lowest balance first)
  const snowball = calculatePayoffSchedule(debts, extraPayment, 'snowball');
  
  return {
    avalanche,
    snowball,
    recommendation: avalanche.totalInterest < snowball.totalInterest ? 'avalanche' : 'snowball',
    interestSaved: Math.abs(avalanche.totalInterest - snowball.totalInterest),
  };
}

function calculatePayoffSchedule(debts, extraPayment, method) {
  // Sort debts by method
  const sorted = [...debts].sort((a, b) => {
    if (method === 'avalanche') {
      return b.interestRate - a.interestRate; // Highest rate first
    } else {
      return a.balance - b.balance; // Lowest balance first
    }
  });
  
  let month = 0;
  let totalInterest = 0;
  let remaining = sorted.map(d => ({ ...d }));
  const schedule = [];
  
  while (remaining.length > 0 && month < 360) { // Max 30 years
    month++;
    let extraAvailable = extraPayment;
    
    remaining = remaining.filter(debt => {
      // Calculate interest for this month
      const monthlyRate = debt.interestRate / 12;
      const interest = debt.balance * monthlyRate;
      totalInterest += interest;
      
      // Apply minimum payment
      let payment = Math.min(debt.minimumPayment, debt.balance + interest);
      debt.balance = debt.balance + interest - payment;
      
      // Apply extra payment to first debt in list
      if (extraAvailable > 0 && debt === remaining[0]) {
        const extraApplied = Math.min(extraAvailable, debt.balance);
        debt.balance -= extraApplied;
        extraAvailable -= extraApplied;
      }
      
      return debt.balance > 0.01; // Keep if not paid off
    });
    
    if (month % 12 === 0) {
      schedule.push({
        year: month / 12,
        debtsRemaining: remaining.length,
        totalBalance: remaining.reduce((sum, d) => sum + d.balance, 0),
        interestPaidToDate: totalInterest,
      });
    }
  }
  
  return {
    method,
    monthsToPayoff: month,
    yearsToPayoff: (month / 12).toFixed(1),
    totalInterest: Math.round(totalInterest),
    schedule,
  };
}

/**
 * Emergency fund recommendation
 */
export function calculateEmergencyFund(monthlyExpenses, employmentStability = 'stable') {
  const multiplier = {
    stable: 3,      // 3-6 months for stable employment
    moderate: 6,    // 6 months for moderate
    unstable: 12,   // 12 months for self-employed/unstable
  };
  
  const months = multiplier[employmentStability] || 6;
  
  return {
    recommendedAmount: monthlyExpenses * months,
    months,
    rationale: `${months} months of expenses for ${employmentStability} employment situation`,
  };
}
