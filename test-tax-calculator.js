#!/usr/bin/env node
/**
 * Test Tax Calculator
 * 
 * Validates tax calculations across multiple scenarios.
 */

import { TaxCalculator } from './src/calculation/tax-calculator.js';

console.log('🧪 Tax Calculator Test Suite\n');

const calculator = new TaxCalculator(2024);

// Test Case 1: Retired couple with mixed income
console.log('═══════════════════════════════════════════════════════════');
console.log('Test 1: Retired Couple (Arizona, both 68 years old)');
console.log('═══════════════════════════════════════════════════════════');

const test1Income = {
  ordinaryIncome: 50000,        // IRA distributions
  longTermCapitalGains: 30000,  // Taxable account withdrawals
  qualifiedDividends: 10000,    // Dividend income
  socialSecurity: 48000,        // Combined SS benefits
  rothDistributions: 20000,     // Tax-free, but counts for IRMAA
  municipalBondInterest: 5000,  // Tax-free, but counts for IRMAA
};

const test1Household = {
  state: 'AZ',
  filingStatus: 'married_joint',
  age1: 68,
  age2: 68,
};

const result1 = calculator.calculateTax(test1Income, test1Household);

console.log('\nIncome:');
console.log(`  Ordinary Income:      $${test1Income.ordinaryIncome.toLocaleString()}`);
console.log(`  Long-Term Cap Gains:  $${test1Income.longTermCapitalGains.toLocaleString()}`);
console.log(`  Qualified Dividends:  $${test1Income.qualifiedDividends.toLocaleString()}`);
console.log(`  Social Security:      $${test1Income.socialSecurity.toLocaleString()}`);
console.log(`  Roth Distributions:   $${test1Income.rothDistributions.toLocaleString()} (tax-free)`);
console.log(`  Muni Bond Interest:   $${test1Income.municipalBondInterest.toLocaleString()} (tax-free)`);

console.log('\nCalculated Values:');
console.log(`  AGI:                  $${Math.round(result1.agi).toLocaleString()}`);
console.log(`  MAGI (for IRMAA):     $${Math.round(result1.magi).toLocaleString()}`);
console.log(`  Taxable Income:       $${Math.round(result1.taxableIncome).toLocaleString()}`);

console.log('\nTax Breakdown:');
console.log(`  Federal Income Tax:   $${Math.round(result1.federalTax).toLocaleString()}`);
console.log(`  State Tax (AZ 2.5%):  $${Math.round(result1.stateTax).toLocaleString()}`);
console.log(`  IRMAA (Medicare):     $${Math.round(result1.irmaa.totalAnnual).toLocaleString()} (Tier ${result1.irmaa.bracket})`);
console.log(`    Part B: $${result1.irmaa.partB.toFixed(2)}/mo × 2 people × 12 = $${(result1.irmaa.partB * 2 * 12).toFixed(2)}`);
console.log(`    Part D: $${result1.irmaa.partD.toFixed(2)}/mo × 2 people × 12 = $${(result1.irmaa.partD * 2 * 12).toFixed(2)}`);
console.log(`  NIIT (3.8% surtax):   $${Math.round(result1.niit).toLocaleString()}`);

console.log('\nTotal Tax Liability:   $' + Math.round(result1.totalTax).toLocaleString());
console.log(`Effective Tax Rate:     ${result1.effectiveRate.toFixed(2)}%`);
console.log(`Marginal Tax Rate:      ${result1.marginalRate}%`);

// Test Case 2: High-income earner in California
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Test 2: High Earner (California, single, age 45)');
console.log('═══════════════════════════════════════════════════════════');

const test2Income = {
  ordinaryIncome: 400000,       // W2 salary
  longTermCapitalGains: 100000, // RSU sales
  qualifiedDividends: 20000,
  socialSecurity: 0,
  rothDistributions: 0,
  municipalBondInterest: 0,
};

const test2Household = {
  state: 'CA',
  filingStatus: 'single',
  age1: 45,
  age2: null,
};

const result2 = calculator.calculateTax(test2Income, test2Household);

console.log('\nIncome:');
console.log(`  Ordinary Income:      $${test2Income.ordinaryIncome.toLocaleString()}`);
console.log(`  Long-Term Cap Gains:  $${test2Income.longTermCapitalGains.toLocaleString()}`);
console.log(`  Qualified Dividends:  $${test2Income.qualifiedDividends.toLocaleString()}`);

console.log('\nCalculated Values:');
console.log(`  AGI:                  $${Math.round(result2.agi).toLocaleString()}`);
console.log(`  Taxable Income:       $${Math.round(result2.taxableIncome).toLocaleString()}`);

console.log('\nTax Breakdown:');
console.log(`  Federal Income Tax:   $${Math.round(result2.federalTax).toLocaleString()}`);
console.log(`  State Tax (CA):       $${Math.round(result2.stateTax).toLocaleString()}`);
console.log(`  IRMAA (Medicare):     $${Math.round(result2.irmaa.totalAnnual).toLocaleString()} (not on Medicare)`);
console.log(`  NIIT (3.8% surtax):   $${Math.round(result2.niit).toLocaleString()}`);

console.log('\nTotal Tax Liability:   $' + Math.round(result2.totalTax).toLocaleString());
console.log(`Effective Tax Rate:     ${result2.effectiveRate.toFixed(2)}%`);
console.log(`Marginal Tax Rate:      ${result2.marginalRate}%`);

// Test Case 3: UHNW couple hitting IRMAA cap
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Test 3: UHNW Couple (New York, both 70, high IRMAA)');
console.log('═══════════════════════════════════════════════════════════');

const test3Income = {
  ordinaryIncome: 500000,
  longTermCapitalGains: 1000000,
  qualifiedDividends: 200000,
  socialSecurity: 0,
  rothDistributions: 500000,    // Counts for IRMAA
  municipalBondInterest: 100000, // Counts for IRMAA
};

const test3Household = {
  state: 'NY',
  filingStatus: 'married_joint',
  age1: 70,
  age2: 70,
};

const result3 = calculator.calculateTax(test3Income, test3Household);

console.log('\nIncome:');
console.log(`  Ordinary Income:      $${test3Income.ordinaryIncome.toLocaleString()}`);
console.log(`  Long-Term Cap Gains:  $${test3Income.longTermCapitalGains.toLocaleString()}`);
console.log(`  Qualified Dividends:  $${test3Income.qualifiedDividends.toLocaleString()}`);
console.log(`  Roth Distributions:   $${test3Income.rothDistributions.toLocaleString()} (tax-free)`);
console.log(`  Muni Bond Interest:   $${test3Income.municipalBondInterest.toLocaleString()} (tax-free)`);

console.log('\nCalculated Values:');
console.log(`  AGI:                  $${Math.round(result3.agi).toLocaleString()}`);
console.log(`  MAGI (for IRMAA):     $${Math.round(result3.magi).toLocaleString()}`);
console.log(`  Taxable Income:       $${Math.round(result3.taxableIncome).toLocaleString()}`);

console.log('\nTax Breakdown:');
console.log(`  Federal Income Tax:   $${Math.round(result3.federalTax).toLocaleString()}`);
console.log(`  State Tax (NY):       $${Math.round(result3.stateTax).toLocaleString()}`);
console.log(`  IRMAA (Medicare):     $${Math.round(result3.irmaa.totalAnnual).toLocaleString()} (Tier ${result3.irmaa.bracket} - HIGHEST)`);
console.log(`    Part B: $${result3.irmaa.partB.toFixed(2)}/mo × 2 people × 12 = $${(result3.irmaa.partB * 2 * 12).toFixed(2)}`);
console.log(`    Part D: $${result3.irmaa.partD.toFixed(2)}/mo × 2 people × 12 = $${(result3.irmaa.partD * 2 * 12).toFixed(2)}`);
console.log(`  NIIT (3.8% surtax):   $${Math.round(result3.niit).toLocaleString()}`);

console.log('\nTotal Tax Liability:   $' + Math.round(result3.totalTax).toLocaleString());
console.log(`Effective Tax Rate:     ${result3.effectiveRate.toFixed(2)}%`);
console.log(`Marginal Tax Rate:      ${result3.marginalRate}%`);

// Summary
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('Summary of Test Results');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('| Scenario | AGI | Total Tax | Effective Rate |');
console.log('|----------|-----|-----------|----------------|');
console.log(`| Retired AZ | $${Math.round(result1.agi).toLocaleString().padStart(9)} | $${Math.round(result1.totalTax).toLocaleString().padStart(9)} | ${result1.effectiveRate.toFixed(2).padStart(6)}% |`);
console.log(`| High CA    | $${Math.round(result2.agi).toLocaleString().padStart(9)} | $${Math.round(result2.totalTax).toLocaleString().padStart(9)} | ${result2.effectiveRate.toFixed(2).padStart(6)}% |`);
console.log(`| UHNW NY    | $${Math.round(result3.agi).toLocaleString().padStart(9)} | $${Math.round(result3.totalTax).toLocaleString().padStart(9)} | ${result3.effectiveRate.toFixed(2).padStart(6)}% |`);

console.log('\n✅ Tax Calculator Test Complete!\n');
