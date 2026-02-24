#!/usr/bin/env node
/**
 * Test PostgreSQL connection
 */

import pg from 'pg';
import fs from 'fs';

// Load credentials
const envContent = fs.readFileSync('.env.database', 'utf-8');
const dbUrl = envContent.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1];

const client = new pg.Client({
  connectionString: dbUrl,
});

async function test() {
  try {
    console.log('🔌 Connecting to PostgreSQL...\n');
    await client.connect();
    
    console.log('✅ Connected successfully!\n');
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL Version:');
    console.log(result.rows[0].version);
    console.log();
    
    // Check existing tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📊 Existing tables: ${tables.rows.length}`);
    if (tables.rows.length > 0) {
      tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    } else {
      console.log('  (empty database - ready for schema creation)');
    }
    
    await client.end();
    console.log('\n✅ Connection test complete.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();
