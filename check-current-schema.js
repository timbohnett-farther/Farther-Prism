#!/usr/bin/env node
/**
 * Check current database schema
 */

import 'dotenv/config';
import { query } from './src/db/pool.js';

async function checkSchema() {
  try {
    console.log('🔍 Checking current database schema...\n');
    console.log(`Connection: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}\n`);
    
    // Get all tables
    const tables = await query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_type, table_name
    `);
    
    console.log(`📊 Found ${tables.rows.length} objects:\n`);
    
    const baseTables = tables.rows.filter(r => r.table_type === 'BASE TABLE');
    const views = tables.rows.filter(r => r.table_type === 'VIEW');
    
    if (baseTables.length > 0) {
      console.log('**Tables:**');
      baseTables.forEach(t => console.log(`  ✓ ${t.table_name}`));
      console.log();
    }
    
    if (views.length > 0) {
      console.log('**Views:**');
      views.forEach(t => console.log(`  ✓ ${t.table_name}`));
      console.log();
    }
    
    // Check if our new institutional schema is present
    const expectedTables = [
      'households', 'people', 'entities', 'accounts', 'lots', 
      'goals', 'scenarios', 'planning_graph', 'monte_carlo_results', 'audit_log'
    ];
    
    const existingTables = baseTables.map(t => t.table_name);
    const missing = expectedTables.filter(t => !existingTables.includes(t));
    const present = expectedTables.filter(t => existingTables.includes(t));
    
    console.log('**Institutional Schema Check:**');
    console.log(`  ✅ Present: ${present.length}/${expectedTables.length} tables`);
    if (present.length > 0) {
      present.forEach(t => console.log(`     - ${t}`));
    }
    
    if (missing.length > 0) {
      console.log(`  ❌ Missing: ${missing.length} tables`);
      missing.forEach(t => console.log(`     - ${t}`));
    }
    
    console.log('\n✅ Database connection successful!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
