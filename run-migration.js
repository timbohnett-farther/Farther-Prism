#!/usr/bin/env node
/**
 * Run database migration
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Load credentials
const envContent = fs.readFileSync('.env.database', 'utf-8');
const dbUrl = envContent.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1];

const client = new pg.Client({
  connectionString: dbUrl,
});

async function runMigration() {
  try {
    console.log('🚀 Running database migration...\n');
    await client.connect();
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Executing 001_initial_schema.sql...\n');
    
    // Run migration
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables created
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📊 Tables created: ${tables.rows.length}\n`);
    tables.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    
    // Check views
    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'VIEW'
      ORDER BY table_name
    `);
    
    if (views.rows.length > 0) {
      console.log(`\n📊 Views created: ${views.rows.length}\n`);
      views.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
    }
    
    await client.end();
    console.log('\n✅ Database ready for Prism!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
