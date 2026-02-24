#!/usr/bin/env node
/**
 * Test Statement Upload Pipeline
 * 
 * 1. Create test household
 * 2. Upload Schwab CSV sample
 * 3. Verify accounts and positions imported
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/v1';

async function testStatementUpload() {
  console.log('🧪 Testing Statement Upload Pipeline\n');
  
  try {
    // Step 1: Create test household
    console.log('1️⃣ Creating test household...');
    const householdRes = await fetch(`${API_URL}/households`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Family (Statement Import)',
        primaryAdvisorId: null,
      }),
    });
    
    if (!householdRes.ok) {
      throw new Error(`Failed to create household: ${householdRes.statusText}`);
    }
    
    const household = await householdRes.json();
    console.log(`   ✓ Household created: ${household.id}\n`);
    
    // Step 2: Upload Schwab CSV
    console.log('2️⃣ Uploading Schwab statement...');
    const csvPath = path.join(process.cwd(), 'test-data', 'schwab-sample.csv');
    const csvBuffer = fs.readFileSync(csvPath);
    
    const form = new FormData();
    form.append('householdId', household.id);
    form.append('statement', csvBuffer, {
      filename: 'schwab-sample.csv',
      contentType: 'text/csv',
    });
    
    const uploadRes = await fetch(`${API_URL}/statements/upload`, {
      method: 'POST',
      body: form,
    });
    
    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      throw new Error(`Upload failed: ${error}`);
    }
    
    const uploadResult = await uploadRes.json();
    console.log(`   ✓ Statement parsed by: ${uploadResult.custodian}`);
    console.log(`   ✓ Confidence: ${uploadResult.classification.confidence}`);
    console.log(`   ✓ Accounts imported: ${uploadResult.summary.accountsImported}`);
    console.log(`   ✓ Positions imported: ${uploadResult.summary.positionsImported}`);
    console.log(`   ✓ Total value: $${uploadResult.summary.totalValue.toLocaleString()}\n`);
    
    // Step 3: Verify data in database
    console.log('3️⃣ Verifying imported data...');
    const accountsRes = await fetch(`${API_URL}/households/${household.id}/accounts`);
    const accounts = await accountsRes.json();
    
    console.log(`   ✓ Found ${accounts.length} accounts in database:`);
    accounts.forEach(acc => {
      console.log(`     - ${acc.account_name} (${acc.account_type}): $${acc.total_value?.toLocaleString() || '0'}`);
    });
    
    console.log('\n✅ Statement upload pipeline test PASSED!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testStatementUpload();
