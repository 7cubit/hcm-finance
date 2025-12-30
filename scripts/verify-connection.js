/**
 * HCMJ Finance - Connection Verification Script
 * 
 * This script verifies that the Next.js frontend can successfully
 * fetch data from the NestJS backend API.
 * 
 * Usage: node scripts/verify-connection.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

async function verifyConnection() {
  console.log('🔍 HCMJ Finance - Connection Verification\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Test 1: Hello World endpoint
    console.log('Test 1: Fetching Hello World from API...');
    const helloResponse = await fetch(API_URL);
    
    if (!helloResponse.ok) {
      throw new Error(`HTTP ${helloResponse.status}: ${helloResponse.statusText}`);
    }
    
    const helloData = await helloResponse.json();
    console.log('✅ Hello World Response:', JSON.stringify(helloData, null, 2));

    // Test 2: Health endpoint
    console.log('\nTest 2: Checking Health endpoint...');
    const healthResponse = await fetch(`${API_URL}/health`);
    
    if (!healthResponse.ok) {
      throw new Error(`HTTP ${healthResponse.status}: ${healthResponse.statusText}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Health Check Response:', JSON.stringify(healthData, null, 2));

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\nThe Next.js frontend can successfully communicate');
    console.log('with the NestJS backend via /api/v1');
    console.log('\nNext steps:');
    console.log('  1. Run: npm run docker:up (start PostgreSQL & Redis)');
    console.log('  2. Run: npm run db:push (sync Prisma schema)');
    console.log('  3. Run: npm run dev (start both apps)');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ CONNECTION FAILED');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure the API is running: npm run dev:api');
    console.error('  2. Check if port 3001 is available');
    console.error('  3. Verify Docker containers are running: npm run docker:up');
    process.exit(1);
  }
}

verifyConnection();
