#!/usr/bin/env node
/**
 * Google Workspace Setup Script
 *
 * This script tests that the Service Account can:
 * 1. Connect to Google APIs
 * 2. Create a file in the Master Folder
 * 3. Share that file with a specific email
 *
 * Usage:
 *   npx ts-node scripts/verify-google-workspace.ts [email-to-share-with]
 *
 * Prerequisites:
 * 1. Create Service Account in GCP Console
 * 2. Download JSON key and save to ./credentials/service-account.json
 * 3. Enable Google Sheets API and Google Drive API
 * 4. Create Master Folder in Google Drive
 * 5. Share Master Folder with service account email (Editor)
 * 6. Set GOOGLE_DRIVE_MASTER_FOLDER_ID in .env
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata',
];

async function main() {
  console.log('🔧 Google Workspace Setup Verification\n');

  // 1. Load credentials
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const masterFolderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID;
  const shareWithEmail = process.argv[2];

  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('❌ Service account key not found. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env');
    console.log('\nSetup Instructions:');
    console.log('1. Go to GCP Console > IAM & Admin > Service Accounts');
    console.log('2. Create service account: sheet-manager@hcmj-finance.iam.gserviceaccount.com');
    console.log('3. Create key (JSON) and download');
    console.log('4. Save to: ./credentials/service-account.json');
    process.exit(1);
  }

  console.log(`✅ Service account key found: ${keyPath}`);

  // 2. Authenticate
  const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  console.log(`✅ Service account email: ${credentials.client_email}`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // 3. Check Drive access
  console.log('\n📂 Checking Google Drive access...');
  try {
    const aboutRes = await drive.about.get({ fields: 'user' });
    console.log(`✅ Connected as: ${aboutRes.data.user?.displayName || 'Service Account'}`);
  } catch (error: any) {
    console.error(`❌ Drive access failed: ${error.message}`);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure Google Drive API is enabled in GCP Console');
    console.log('2. Check service account has correct permissions');
    process.exit(1);
  }

  // 4. Check Master Folder access
  if (masterFolderId) {
    console.log('\n📁 Checking Master Folder access...');
    try {
      const folderRes = await drive.files.get({
        fileId: masterFolderId,
        fields: 'name, id',
      });
      console.log(`✅ Master Folder found: ${folderRes.data.name}`);

      // List files in folder
      const listRes = await drive.files.list({
        q: `'${masterFolderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 10,
      });
      console.log(`   Contains ${listRes.data.files?.length || 0} files`);
    } catch (error: any) {
      console.error(`❌ Cannot access Master Folder: ${error.message}`);
      console.log('\nTroubleshooting:');
      console.log('1. Share the folder with: ' + credentials.client_email);
      console.log('2. Give Editor access');
      process.exit(1);
    }
  } else {
    console.log('\n⚠️  GOOGLE_DRIVE_MASTER_FOLDER_ID not set. Creating test folder...');
    const folder = await drive.files.create({
      requestBody: {
        name: 'HCMJ Finance Master (Test)',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name',
    });
    console.log(`✅ Created folder: ${folder.data.name} (${folder.data.id})`);
    console.log(`\n📋 Add to .env: GOOGLE_DRIVE_MASTER_FOLDER_ID=${folder.data.id}`);
  }

  // 5. Create test spreadsheet
  console.log('\n📊 Creating test spreadsheet...');
  const testName = `HCMJ_${new Date().getFullYear()}_Test_${Date.now().toString(36)}`;
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: testName },
      sheets: [{ properties: { title: 'TestSheet' } }],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;
  console.log(`✅ Created: ${testName}`);
  console.log(`   URL: ${spreadsheet.data.spreadsheetUrl}`);

  // Move to master folder if set
  if (masterFolderId) {
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: masterFolderId,
      fields: 'id, parents',
    });
    console.log(`   Moved to Master Folder`);
  }

  // 6. Share with email if provided
  if (shareWithEmail) {
    console.log(`\n📤 Sharing with ${shareWithEmail}...`);
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: shareWithEmail,
      },
      sendNotificationEmail: false,
    });
    console.log(`✅ Shared successfully`);
  }

  // 7. Write test data
  console.log('\n✏️  Writing test data...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'TestSheet!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        ['HCMJ Finance Setup Test'],
        ['Created at:', new Date().toISOString()],
        ['Status:', 'SUCCESS ✅'],
      ],
    },
  });
  console.log(`✅ Data written`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Google Workspace integration is working!\n');
  console.log('Next steps:');
  if (!masterFolderId) {
    console.log('1. Add GOOGLE_DRIVE_MASTER_FOLDER_ID to .env');
  }
  console.log(`${masterFolderId ? '1' : '2'}. For Domain-Wide Delegation (G Suite):`);
  console.log('   a) In GCP: Enable Domain-wide delegation for the service account');
  console.log('   b) Copy the Client ID (numeric)');
  console.log('   c) In Google Admin Console:');
  console.log('      Security > API Controls > Domain-wide delegation > Add new');
  console.log('      Client ID: [paste Client ID]');
  console.log('      Scopes: ' + SCOPES.join(','));
  console.log(`   d) Set GOOGLE_ADMIN_EMAIL in .env to impersonate an admin user`);
}

main().catch(console.error);
