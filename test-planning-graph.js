#!/usr/bin/env node
/**
 * Test Planning Graph Service
 * 
 * End-to-end test of integrated planning engine.
 */

import { PlanningGraphService } from './src/services/planning-graph-service.js';

console.log('🧪 Planning Graph Service Test\n');

const service = new PlanningGraphService();

// Test scenario: Retired couple planning for 5 years
const scenario = {
  people: [
    {
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1956-03-15', // Age 68 in 2024
      relationship: 'primary',
    },
    {
      firstName: 'Mary',
      lastName: 'Smith',
      dateOfBirth: '1958-07-22', // Age 66 in 2024
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
      endDate: null, // Lifetime
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
  
  goals: [
    {
      goalType: 'retirement',
      description: 'Maintain $120K/year lifestyle',
      targetAmount: 120000,
      targetDate: '2050-12-31',
      priority: 1,
    },
  ],
  
  assumptions: {
    state: 'AZ',
    filingStatus: 'married_joint',
    portfolioReturn: 0.07, // 7% annual
    inflationRate: 0.03, // 3% annual
    allowRothWithdrawals: false,
    charitableGiving: 10000, // $10K/year via QCDs
    taxLossHarvesting: 0,
    rothConversionBudget: 25000, // Up to $25K/year
  },
};

const scenarioId = 'test-scenario-001';
const startDate = '2024-01-01';
const endDate = '2028-12-31'; // 5 years

console.log('═══════════════════════════════════════════════════════════');
console.log('Test Scenario: Retired Couple (5-Year Projection)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('People:');
scenario.people.forEach(p => {
  const age = service.calculateAge(p.dateOfBirth, startDate);
  console.log(`  ${p.firstName} ${p.lastName} (age ${age})`);
});

console.log('\nAccounts:');
scenario.accounts.forEach(a => {
  console.log(`  ${a.account_type.padEnd(20)}: $${a.current_value.toLocaleString()}`);
});
const totalAccounts = scenario.accounts.reduce((sum, a) => sum + a.current_value, 0);
console.log(`  ${'Total'.padEnd(20)}: $${totalAccounts.toLocaleString()}`);

console.log('\nIncome:');
scenario.incomeStreams.forEach(i => {
  console.log(`  ${i.description.padEnd(30)}: $${i.amount.toLocaleString()}/year`);
});

console.log('\nExpenses:');
scenario.expenseStreams.forEach(e => {
  const annual = e.frequency === 'monthly' ? e.amount * 12 : e.amount;
  console.log(`  ${e.description.padEnd(30)}: $${annual.toLocaleString()}/year`);
});
const totalExpenses = scenario.expenseStreams.reduce((sum, e) => {
  return sum + (e.frequency === 'monthly' ? e.amount * 12 : e.amount);
}, 0);
console.log(`  ${'Total'.padEnd(30)}: $${totalExpenses.toLocaleString()}/year`);

console.log('\nSpending Gap:');
const totalIncome = scenario.incomeStreams.reduce((sum, i) => sum + i.amount, 0);
const spendingGap = totalExpenses - totalIncome;
console.log(`  Income:                         $${totalIncome.toLocaleString()}`);
console.log(`  Expenses:                       $${totalExpenses.toLocaleString()}`);
console.log(`  Gap (from portfolio):           $${spendingGap.toLocaleString()}`);

console.log('\n\nGenerating planning graph...\n');

// Generate planning graph
const graphEntries = await service.generatePlanningGraph(scenarioId, scenario, {
  startDate,
  endDate,
  monthlyGranularity: true,
});

console.log('✅ Planning graph generated!\n');

// Analyze results
const decemberEntries = graphEntries.filter(e => e.month_date.endsWith('-12-01'));

console.log('═══════════════════════════════════════════════════════════');
console.log('Year-End Summary (December each year)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('| Year | Age | Taxable | Tax-Def | Roth | Total Assets | Withdrawals | Taxes |');
console.log('|------|-----|---------|---------|------|--------------|-------------|-------|');

decemberEntries.forEach(entry => {
  const year = entry.month_date.substring(0, 4);
  const age = entry.age_primary;
  const taxable = Math.round(entry.taxable_balance / 1000);
  const taxDeferred = Math.round(entry.tax_deferred_balance / 1000);
  const taxFree = Math.round(entry.tax_free_balance / 1000);
  const total = taxable + taxDeferred + taxFree;
  const withdrawals = Math.round(entry.total_withdrawals / 1000);
  const taxes = Math.round(entry.total_tax / 1000);
  
  console.log(`| ${year} | ${age.toString().padStart(3)} | $${taxable.toString().padStart(6)}K | $${taxDeferred.toString().padStart(6)}K | $${taxFree.toString().padStart(5)}K | $${total.toString().padStart(11)}K | $${withdrawals.toString().padStart(10)}K | $${taxes.toString().padStart(4)}K |`);
});

// Summary statistics
const firstYear = decemberEntries[0];
const lastYear = decemberEntries[decemberEntries.length - 1];

const startingAssets = firstYear.taxable_balance + firstYear.tax_deferred_balance + firstYear.tax_free_balance;
const endingAssets = lastYear.taxable_balance + lastYear.tax_deferred_balance + lastYear.tax_free_balance;
const assetChange = endingAssets - startingAssets;

const totalWithdrawals = decemberEntries.reduce((sum, e) => sum + e.total_withdrawals, 0);
const totalTaxes = decemberEntries.reduce((sum, e) => sum + e.total_tax, 0);

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('5-Year Summary');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Starting Assets:     $${Math.round(startingAssets).toLocaleString()}`);
console.log(`Ending Assets:       $${Math.round(endingAssets).toLocaleString()}`);
console.log(`Asset Change:        $${Math.round(assetChange).toLocaleString()} (${((assetChange / startingAssets) * 100).toFixed(1)}%)`);
console.log(`\nTotal Withdrawals:   $${Math.round(totalWithdrawals).toLocaleString()}`);
console.log(`Total Taxes Paid:    $${Math.round(totalTaxes).toLocaleString()}`);
console.log(`Average Tax Rate:    ${((totalTaxes / totalWithdrawals) * 100).toFixed(2)}%`);

console.log('\n✅ Planning Graph Test Complete!\n');
