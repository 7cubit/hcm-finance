import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

/**
 * Verification Script: Phase 4 Permissions
 * 
 * Usage: npx ts-node scripts/test-sheet-permissions.ts [target-email] [spreadsheet-id]
 */

async function main() {
  const targetEmail = process.argv[2];
  const spreadsheetId = process.argv[3];

  if (!targetEmail || !spreadsheetId) {
    console.error('❌ Missing arguments.');
    console.log('Usage: npx ts-node scripts/test-sheet-permissions.ts [target-email] [spreadsheet-id]');
    process.exit(1);
  }

  console.log(`🧪 Testing permissions for ${targetEmail} on sheet ${spreadsheetId}...`);

  // 1. Initialize Auth
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const credentials = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), keyPath!), 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    // 2. Grant Access
    console.log('➕ Step 1: Granting "writer" access (suppressing email notification)...');
    const resGrant = await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: targetEmail,
      },
      sendNotificationEmail: false,
    });
    const permissionId = resGrant.data.id!;
    console.log(`✅ Access granted. Permission ID: ${permissionId}`);

    // 3. Verify Permission exists
    console.log('🔍 Step 2: Verifying permission list...');
    const resList = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: 'permissions(id, emailAddress, role)',
    });

    const check = resList.data.permissions?.find(p => p.emailAddress?.toLowerCase() === targetEmail.toLowerCase());
    if (check) {
      console.log(`✨ Found permission: ${check.emailAddress} is a ${check.role}`);
    } else {
      throw new Error('Verification failed: Permission not found in list');
    }

    // 4. Revoke Access
    console.log('➖ Step 3: Revoking access...');
    await drive.permissions.delete({
      fileId: spreadsheetId,
      permissionId: permissionId,
    });
    console.log('✅ Access revoked.');

    // 5. Final Check
    console.log('🔍 Step 4: Final verification...');
    const resFinal = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: 'permissions(id, emailAddress)',
    });
    const checkFinal = resFinal.data.permissions?.find(p => p.emailAddress?.toLowerCase() === targetEmail.toLowerCase());
    
    if (!checkFinal) {
      console.log('🎉 Verification successful: User no longer has access.');
    } else {
      throw new Error('Revocation failed: Permission still exists in list');
    }

  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
