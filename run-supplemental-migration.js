#!/usr/bin/env node
/**
 * Run supplemental migration (002)
 */

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log('🚀 Running supplemental migration (002)...\n');
    await client.connect();
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '002_supplemental_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Executing 002_supplemental_tables.sql...\n');
    
    // Run migration
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables created
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('relationships', 'income_streams', 'expense_streams', 'expense_categories')
      ORDER BY table_name
    `);
    
    console.log(`📊 New tables created: ${tables.rows.length}\n`);
    tables.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    
    // Check views
    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'VIEW'
        AND table_name IN ('positions', 'plans')
      ORDER BY table_name
    `);
    
    if (views.rows.length > 0) {
      console.log(`\n📊 Compatibility views created: ${views.rows.length}\n`);
      views.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    }
    
    await client.end();
    console.log('\n✅ Prism prototype is now fully compatible with institutional schema!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
