#!/usr/bin/env node
/**
 * Test Withdrawal Sequencer
 * 
 * Validates withdrawal optimization across different scenarios.
 */

import { WithdrawalSequencer } from './src/calculation/withdrawal-sequencer.js';

console.log('🧪 Withdrawal Sequencer Test Suite\n');

const sequencer = new WithdrawalSequencer();

// Test Case 1: Early retiree (age 62, no RMDs yet)
console.log('═══════════════════════════════════════════════════════════');
console.log('Test 1: Early Retiree (Age 62, Arizona, $120K spending need)');
console.log('═══════════════════════════════════════════════════════════\n');

const test1Accounts = {
  taxable: 500000,
  ira_traditional: 800000,
  ira_roth: 200000,
  '401k_traditional': 0,
};

const test1Needs = {
  targetSpending: 120000,
  otherIncome: 0, // Not claiming SS yet
  allowRothWithdrawals: false,
  charitableGiving: 0,
  taxLossHarvesting: 20000, // $20K losses available
  rothConversionBudget: 0,
};

const test1Household = {
  state: 'AZ',
  filingStatus: 'married_joint',
  age1: 62,
  age2: 60,
};

const result1 = sequencer.optimizeWithdrawals(test1Accounts, test1Needs, test1Household);

console.log('Account Balances:');
console.log(`  Taxable:              $${test1Accounts.taxable.toLocaleString()}`);
console.log(`  Traditional IRA:      $${test1Accounts.ira_traditional.toLocaleString()}`);
console.log(`  Roth IRA:             $${test1Accounts.ira_roth.toLocaleString()}`);
console.log(`  Total:                $${Object.values(test1Accounts).reduce((a, b) => a + b, 0).toLocaleString()}`);

console.log('\nOptimized Withdrawal Plan:');
Object.entries(result1.withdrawals).forEach(([account, amount]) => {
  console.log(`  ${account.padEnd(20)}: $${Math.round(amount).toLocaleString()}`);
});

console.log('\nTax Summary:');
console.log(`  AGI:                  $${Math.round(result1.taxes.agi).toLocaleString()}`);
console.log(`  Federal Tax:          $${Math.round(result1.taxes.federalTax).toLocaleString()}`);
console.log(`  State Tax (AZ):       $${Math.round(result1.taxes.stateTax).toLocaleString()}`);
console.log(`  Total Tax:            $${Math.round(result1.taxes.totalTax).toLocaleString()}`);
console.log(`  Effective Rate:       ${result1.taxes.effectiveRate.toFixed(2)}%`);

console.log('\nSpending Power:');
console.log(`  Target Spending:      $${result1.summary.targetSpending.toLocaleString()}`);
console.log(`  Gross Withdrawals:    $${Math.round(result1.summary.grossWithdrawals).toLocaleString()}`);
console.log(`  After-Tax Spending:   $${Math.round(result1.summary.afterTaxSpending).toLocaleString()}`);
console.log(`  Shortfall:            $${Math.round(result1.summary.shortfall).toLocaleString()}`);

console.log('\nOptimization:');
console.log(`  Tax Loss Harvested:   $${result1.optimization.taxLossHarvested.toLocaleString()}`);
console.log(`  Efficiency Score:     ${Math.round(result1.optimization.efficiencyScore)}/100`);

// Test Case 2: Retiree with RMDs and charitable giving
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Test 2: Retiree with RMDs (Age 75, $25K charitable giving)');
console.log('═══════════════════════════════════════════════════════════\n');

const test2Accounts = {
  taxable: 300000,
  ira_traditional: 1200000,
  ira_roth: 400000,
  '401k_traditional': 0,
};

const test2Needs = {
  targetSpending: 100000,
  otherIncome: 48000, // Social Security
  allowRothWithdrawals: false,
  charitableGiving: 25000, // Use QCDs
  taxLossHarvesting: 0,
  rothConversionBudget: 0,
};

const test2Household = {
  state: 'AZ',
  filingStatus: 'married_joint',
  age1: 75,
  age2: 73,
};

const result2 = sequencer.optimizeWithdrawals(test2Accounts, test2Needs, test2Household);

console.log('Account Balances:');
console.log(`  Taxable:              $${test2Accounts.taxable.toLocaleString()}`);
console.log(`  Traditional IRA:      $${test2Accounts.ira_traditional.toLocaleString()}`);
console.log(`  Roth IRA:             $${test2Accounts.ira_roth.toLocaleString()}`);
console.log(`  Total:                $${Object.values(test2Accounts).reduce((a, b) => a + b, 0).toLocaleString()}`);

console.log('\nRequired Minimum Distributions (RMDs):');
Object.entries(result2.rmds).forEach(([account, amount]) => {
  console.log(`  ${account.padEnd(20)}: $${Math.round(amount).toLocaleString()} (REQUIRED)`);
});

console.log('\nOptimized Withdrawal Plan:');
Object.entries(result2.withdrawals).forEach(([account, amount]) => {
  console.log(`  ${account.padEnd(20)}: $${Math.round(amount).toLocaleString()}`);
});

console.log('\nTax Summary:');
console.log(`  AGI:                  $${Math.round(result2.taxes.agi).toLocaleString()}`);
console.log(`  Federal Tax:          $${Math.round(result2.taxes.federalTax).toLocaleString()}`);
console.log(`  State Tax (AZ):       $${Math.round(result2.taxes.stateTax).toLocaleString()}`);
console.log(`  IRMAA:                $${Math.round(result2.taxes.irmaa.totalAnnual).toLocaleString()}`);
console.log(`  Total Tax:            $${Math.round(result2.taxes.totalTax).toLocaleString()}`);
console.log(`  Effective Rate:       ${result2.taxes.effectiveRate.toFixed(2)}%`);

console.log('\nSpending Power:');
console.log(`  Target Spending:      $${result2.summary.targetSpending.toLocaleString()}`);
console.log(`  Social Security:      $${test2Needs.otherIncome.toLocaleString()}`);
console.log(`  Gross Withdrawals:    $${Math.round(result2.summary.grossWithdrawals).toLocaleString()}`);
console.log(`  After-Tax Spending:   $${Math.round(result2.summary.afterTaxSpending).toLocaleString()}`);

console.log('\nOptimization:');
console.log(`  QCD Used:             $${result2.optimization.qcdUsed.toLocaleString()} (saved ~$${Math.round(result2.optimization.qcdUsed * 0.22).toLocaleString()} in taxes)`);
console.log(`  Efficiency Score:     ${Math.round(result2.optimization.efficiencyScore)}/100`);

// Test Case 3: Roth conversion opportunity
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Test 3: Low-Income Year - Roth Conversion Opportunity');
console.log('═══════════════════════════════════════════════════════════\n');

const test3Accounts = {
  taxable: 200000,
  ira_traditional: 900000,
  ira_roth: 100000,
  '401k_traditional': 0,
};

const test3Needs = {
  targetSpending: 60000, // Low spending year
  otherIncome: 30000,
  allowRothWithdrawals: false,
  charitableGiving: 0,
  taxLossHarvesting: 0,
  rothConversionBudget: 50000, // Convert up to $50K
};

const test3Household = {
  state: 'AZ',
  filingStatus: 'married_joint',
  age1: 68,
  age2: 66,
};

const result3 = sequencer.optimizeWithdrawals(test3Accounts, test3Needs, test3Household);

console.log('Account Balances:');
console.log(`  Taxable:              $${test3Accounts.taxable.toLocaleString()}`);
console.log(`  Traditional IRA:      $${test3Accounts.ira_traditional.toLocaleString()}`);
console.log(`  Roth IRA:             $${test3Accounts.ira_roth.toLocaleString()}`);

console.log('\nOptimized Withdrawal Plan:');
Object.entries(result3.withdrawals).forEach(([account, amount]) => {
  console.log(`  ${account.padEnd(20)}: $${Math.round(amount).toLocaleString()}`);
});

console.log('\nRoth Conversion Analysis:');
console.log(`  Current Marginal Rate: ${result3.taxes.marginalRate}%`);
console.log(`  Conversion Amount:     $${result3.rothConversion.amount.toLocaleString()}`);
console.log(`  Additional Tax:        $${Math.round(result3.rothConversion.additionalTax).toLocaleString()}`);
console.log(`  Future Benefit:        $${Math.round(result3.rothConversion.benefit).toLocaleString()}`);
console.log(`  Break-Even Years:      ${Math.round(result3.rothConversion.breakEvenYears)} years`);
console.log(`  Recommendation:        ${result3.rothConversion.recommendation} ✅`);

console.log('\nTax Summary (with conversion):');
console.log(`  Base Tax:             $${Math.round(result3.taxes.totalTax).toLocaleString()}`);
console.log(`  Conversion Tax:       $${Math.round(result3.rothConversion.additionalTax).toLocaleString()}`);
console.log(`  Total Tax:            $${Math.round(result3.taxes.totalTax + result3.rothConversion.additionalTax).toLocaleString()}`);

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Summary of Strategies');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('| Scenario | Tax Rate | Efficiency | Key Strategy |');
console.log('|----------|----------|------------|--------------|');
console.log(`| Early Retire | ${result1.taxes.effectiveRate.toFixed(1).padStart(6)}% | ${Math.round(result1.optimization.efficiencyScore).toString().padStart(10)} | Tax-loss harvest |`);
console.log(`| RMD + QCD    | ${result2.taxes.effectiveRate.toFixed(1).padStart(6)}% | ${Math.round(result2.optimization.efficiencyScore).toString().padStart(10)} | QCD for charity |`);
console.log(`| Low Income   | ${result3.taxes.effectiveRate.toFixed(1).padStart(6)}% | ${Math.round(result3.optimization.efficiencyScore).toString().padStart(10)} | Roth conversion |`);

console.log('\n✅ Withdrawal Sequencer Test Complete!\n');
