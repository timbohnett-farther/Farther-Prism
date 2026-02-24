#!/usr/bin/env node
const AWS = require('aws-sdk');

// Load credentials from .env.backblaze
const fs = require('fs');
const envContent = fs.readFileSync('.env.backblaze', 'utf-8');
const config = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) config[key.trim()] = value.trim();
  }
});

// Configure S3 client for Backblaze B2
// Note: For B2, accessKeyId = keyID, secretAccessKey = application key
const s3 = new AWS.S3({
  endpoint: `https://${config.BACKBLAZE_ENDPOINT}`,
  accessKeyId: config.BACKBLAZE_KEY_ID,
  secretAccessKey: config.BACKBLAZE_APPLICATION_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: config.BACKBLAZE_REGION
});

console.log('Using credentials:');
console.log(`  Key ID: ${config.BACKBLAZE_KEY_ID}`);
console.log(`  Application Key: ${config.BACKBLAZE_APPLICATION_KEY.substring(0, 10)}...`);

console.log('🔌 Testing Backblaze B2 connection...\n');
console.log(`Endpoint: ${config.BACKBLAZE_ENDPOINT}`);
console.log(`Bucket: ${config.BACKBLAZE_BUCKET_NAME}\n`);

// Test 1: List buckets
s3.listBuckets((err, data) => {
  if (err) {
    console.error('❌ Error listing buckets:', err.message);
    return;
  }
  console.log('✅ Successfully connected to Backblaze B2');
  console.log(`Found ${data.Buckets.length} bucket(s):\n`);
  data.Buckets.forEach(bucket => {
    console.log(`  - ${bucket.Name} (created ${bucket.CreationDate})`);
  });
  
  // Test 2: List objects in FartherData bucket
  console.log(`\n📂 Contents of ${config.BACKBLAZE_BUCKET_NAME}:`);
  s3.listObjectsV2({ Bucket: config.BACKBLAZE_BUCKET_NAME }, (err, data) => {
    if (err) {
      console.error('❌ Error listing objects:', err.message);
      return;
    }
    if (data.Contents.length === 0) {
      console.log('  (empty - ready for data ingestion)');
    } else {
      data.Contents.forEach(obj => {
        console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
      });
    }
    console.log('\n✅ Connection test complete. Ready to ingest data.');
  });
});
