#!/usr/bin/env node
/**
 * Test Monte Carlo Service
 * 
 * Runs a test simulation with sample scenario data.
 */

import { MonteCarloService } from './src/services/monte-carlo-service.js';

console.log('🎲 Monte Carlo Simulation Test\n');

const service = new MonteCarloService();

// Test scenario: Retired couple with $1.5M portfolio
const scenario = {
  people: [
    {
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1956-03-15', // Age 68
      relationship: 'primary',
    },
    {
      firstName: 'Mary',
      lastName: 'Smith',
      dateOfBirth: '1958-07-22', // Age 66
      relationship: 'spouse',
    },
  ],
  
  accounts: [
    {
      id: '1',
      account_type: 'taxable',
      current_value: 500000,
    },
    {
      id: '2',
      account_type: 'ira_traditional',
      current_value: 800000,
    },
    {
      id: '3',
      account_type: 'ira_roth',
      current_value: 200000,
    },
  ],
  
  incomeStreams: [
    {
      type: 'social_security',
      amount: 48000, // Annual
      frequency: 'annual',
      description: 'Combined Social Security',
      startDate: '2024-01-01',
      endDate: null,
    },
  ],
  
  expenseStreams: [
    {
      category: 'living',
      amount: 8000, // Monthly
      frequency: 'monthly',
      description: 'Living expenses',
      isDiscretionary: false,
    },
    {
      category: 'discretionary',
      amount: 2000, // Monthly
      frequency: 'monthly',
      description: 'Travel and entertainment',
      isDiscretionary: true,
    },
  ],
  
  assumptions: {
    stockAllocation: 0.60, // 60% stocks (preservation-focused)
    inflationRate: 0.03, // 3%
    taxAlpha: 0.02, // 2% tax alpha (Farther advantage)
  },
};

const scenarioId = 'test-scenario-mc-001';

console.log('═══════════════════════════════════════════════════════════');
console.log('Test Scenario: Retired Couple');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Portfolio:');
console.log(`  Taxable:              $${scenario.accounts[0].current_value.toLocaleString()}`);
console.log(`  Traditional IRA:      $${scenario.accounts[1].current_value.toLocaleString()}`);
console.log(`  Roth IRA:             $${scenario.accounts[2].current_value.toLocaleString()}`);
const totalPortfolio = scenario.accounts.reduce((sum, a) => sum + a.current_value, 0);
console.log(`  Total:                $${totalPortfolio.toLocaleString()}`);

console.log('\nIncome:');
console.log(`  Social Security:      $${scenario.incomeStreams[0].amount.toLocaleString()}/year`);

console.log('\nExpenses:');
const annualExpenses = scenario.expenseStreams.reduce((sum, e) => {
  return sum + (e.frequency === 'monthly' ? e.amount * 12 : e.amount);
}, 0);
console.log(`  Total:                $${annualExpenses.toLocaleString()}/year`);

const spendingGap = annualExpenses - scenario.incomeStreams[0].amount;
console.log(`\nSpending Gap (from portfolio): $${spendingGap.toLocaleString()}/year`);

console.log('\nAssumptions:');
console.log(`  Stock Allocation:     ${(scenario.assumptions.stockAllocation * 100).toFixed(0)}%`);
console.log(`  Inflation Rate:       ${(scenario.assumptions.inflationRate * 100).toFixed(1)}%`);
console.log(`  Tax Alpha (Farther):  ${(scenario.assumptions.taxAlpha * 100).toFixed(1)}%`);

console.log('\n\nRunning Monte Carlo simulation...\n');
console.log('Parameters:');
console.log('  Simulations: 10,000');
console.log('  Time Horizon: 30 years');
console.log('  Approach: Preservation-first (Farther philosophy)');
console.log('');

try {
  const result = await service.runSimulation(scenarioId, scenario, {
    simulations: 10000,
    years: 30,
  });

  console.log('\n✅ Simulation Complete!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Results');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Success Rate:          ${(result.analysis.successRate * 100).toFixed(1)}%`);
  console.log(`  (Portfolio survives 30 years)\n`);

  console.log('Portfolio Values at Year 30:');
  console.log(`  Median (50th %ile):   $${Math.round(result.analysis.median).toLocaleString()}`);
  console.log(`  Best Case (95th):     $${Math.round(result.analysis.percentile95).toLocaleString()}`);
  console.log(`  Worst Case (5th):     $${Math.round(result.analysis.percentile5).toLocaleString()}`);
  console.log(`  Average:              $${Math.round(result.analysis.averageEnding).toLocaleString()}\n`);

  console.log('Probabilities:');
  console.log(`  Portfolio Depleted:   ${(result.analysis.probabilities.depleted * 100).toFixed(1)}%`);
  console.log(`  Wealth Preserved:     ${(result.analysis.probabilities.preservedWealth * 100).toFixed(1)}%`);
  console.log(`  Wealth Doubled:       ${(result.analysis.probabilities.doubledWealth * 100).toFixed(1)}%`);

  console.log(`\nExecution Time:        ${(result.duration / 1000).toFixed(2)} seconds`);
  console.log(`Simulations/sec:       ${Math.round(result.simulations / (result.duration / 1000)).toLocaleString()}`);

  console.log('\n✅ Monte Carlo Service Test Complete!\n');

} catch (error) {
  console.error('\n❌ Test Failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
