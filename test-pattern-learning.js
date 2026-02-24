#!/usr/bin/env node
/**
 * Test Pattern Learning System
 * 
 * 1. Upload Schwab statement (first time - learns pattern)
 * 2. Upload same statement again (second time - uses pattern)
 * 3. Verify pattern was matched and used
 * 4. Check pattern statistics
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/v1';

async function testPatternLearning() {
  console.log('🧠 Testing Pattern Learning System\n');
  
  try {
    // Step 1: Create test household
    console.log('1️⃣ Creating test household...');
    const householdRes = await fetch(`${API_URL}/households`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pattern Learning Test',
        primaryAdvisorId: null,
      }),
    });
    
    const household = await householdRes.json();
    console.log(`   ✓ Household created: ${household.id}\n`);
    
    // Step 2: Upload Schwab statement (FIRST TIME - will learn)
    console.log('2️⃣ First upload (should learn pattern)...');
    const csvPath = path.join(process.cwd(), 'test-data', 'schwab-sample.csv');
    const csvBuffer = fs.readFileSync(csvPath);
    
    const form1 = new FormData();
    form1.append('householdId', household.id);
    form1.append('statement', csvBuffer, {
      filename: 'schwab-sample.csv',
      contentType: 'text/csv',
    });
    
    const start1 = Date.now();
    const upload1 = await fetch(`${API_URL}/statements/upload`, {
      method: 'POST',
      body: form1,
    });
    const duration1 = Date.now() - start1;
    
    const result1 = await upload1.json();
    console.log(`   ✓ Custodian: ${result1.custodian}`);
    console.log(`   ✓ Confidence: ${result1.classification.confidence}`);
    console.log(`   ✓ Used pattern: ${result1.usedPattern ? 'Yes' : 'No (learned new)'}`);
    console.log(`   ✓ Duration: ${duration1}ms\n`);
    
    // Step 3: Upload same statement AGAIN (should use pattern)
    console.log('3️⃣ Second upload (should use learned pattern)...');
    
    const form2 = new FormData();
    form2.append('householdId', household.id);
    form2.append('statement', csvBuffer, {
      filename: 'schwab-sample.csv',
      contentType: 'text/csv',
    });
    
    const start2 = Date.now();
    const upload2 = await fetch(`${API_URL}/statements/upload`, {
      method: 'POST',
      body: form2,
    });
    const duration2 = Date.now() - start2;
    
    const result2 = await upload2.json();
    console.log(`   ✓ Custodian: ${result2.custodian}`);
    console.log(`   ✓ Confidence: ${result2.classification.confidence || result2.usedPattern?.confidence}`);
    console.log(`   ✓ Used pattern: ${result2.usedPattern ? 'YES ✅' : 'No'}`);
    if (result2.usedPattern) {
      console.log(`   ✓ Pattern match score: ${result2.usedPattern.matchScore?.toFixed(2)}`);
    }
    console.log(`   ✓ Duration: ${duration2}ms\n`);
    
    // Step 4: Check pattern statistics
    console.log('4️⃣ Pattern learning statistics...');
    const statsRes = await fetch(`${API_URL}/statements/patterns/stats`);
    const stats = await statsRes.json();
    
    console.log(`   ✓ Total patterns learned: ${stats.totalPatterns}`);
    console.log(`   ✓ Total matches: ${stats.totalMatches}`);
    console.log(`   ✓ Total successes: ${stats.totalSuccesses}\n`);
    
    if (stats.patterns.length > 0) {
      console.log('   📊 Pattern breakdown:');
      stats.patterns.forEach(p => {
        console.log(`     - ${p.custodian_name}: ${p.pattern_count} patterns, ${p.total_matches} matches, ${(parseFloat(p.avg_confidence) * 100).toFixed(0)}% avg confidence`);
      });
    }
    
    // Verify learning worked
    console.log('\n✅ Pattern Learning Test Results:');
    if (result2.usedPattern && result2.usedPattern.custodian === result1.custodian) {
      console.log('   ✅ PASS: Second upload used learned pattern');
      console.log(`   ✅ PASS: Pattern matched correct custodian (${result2.usedPattern.custodian})`);
      if (duration2 < duration1) {
        console.log(`   ✅ PASS: Second upload was faster (${duration1}ms → ${duration2}ms)`);
      } else {
        console.log(`   ⚠️  WARNING: Second upload not faster (${duration1}ms → ${duration2}ms)`);
      }
    } else {
      console.log('   ❌ FAIL: Second upload did not use learned pattern');
    }
    
    console.log('\n✅ Pattern learning test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPatternLearning();
