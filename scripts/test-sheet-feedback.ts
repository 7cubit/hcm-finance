import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

/**
 * Verification Script: Phase 6 Feedback Loop
 * 
 * Usage: npx ts-node scripts/test-sheet-feedback.ts [spreadsheet-id] [tab-name] [row-index]
 * Example: npx ts-node scripts/test-sheet-feedback.ts 1ABC Jan 5
 */

async function main() {
  const spreadsheetId = process.argv[2];
  const tabName = process.argv[3] || 'Jan';
  const rowIndex = parseInt(process.argv[4] || '5');

  if (!spreadsheetId) {
    console.error('❌ Missing spreadsheet ID.');
    process.exit(1);
  }

  console.log(`🧪 Testing Phase 6 Feedback on Sheet ${spreadsheetId}, Tab ${tabName}, Row ${rowIndex}...`);

  // Auth setup
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const credentials = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), keyPath!), 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Get Sheet ID
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === tabName);
    const sheetId = sheet?.properties?.sheetId!;

    console.log('🟢 Step 1: Turning Row Green (APPROVED)...');
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Background Color
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex, startColumnIndex: 0, endColumnIndex: 7 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.85, green: 0.92, blue: 0.83 }
                }
              },
              fields: 'userEnteredFormat.backgroundColor'
            }
          },
          // Status Text
          {
            updateCells: {
              range: { sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex, startColumnIndex: 5, endColumnIndex: 6 },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'APPROVED ✅' } }] }],
              fields: 'userEnteredValue'
            }
          }
        ]
      }
    });

    console.log('✅ Success! Row 5 should now be Green with "APPROVED ✅" status.');
  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

main().catch(console.error);
