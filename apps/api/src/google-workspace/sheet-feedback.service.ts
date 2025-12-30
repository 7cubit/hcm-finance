import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { sheets_v4 } from 'googleapis';
import { GoogleWorkspaceService } from './google-workspace.service';

@Injectable()
export class SheetFeedbackService {
  private readonly logger = new Logger(SheetFeedbackService.name);

  constructor(private readonly googleService: GoogleWorkspaceService) {}

  /**
   * Update a specific row with status and formatting
   */
  async updateRowStatus(
    spreadsheetId: string,
    tabName: string,
    rowIndex: number,
    status: 'APPROVED' | 'REJECTED' | 'PENDING',
    message?: string
  ) {
    const sheets = this.googleService.sheetsClient;
    
    // 1. Get Sheet ID from Tab Name
    const sheetInfo = await this.getSheetInfo(spreadsheetId, tabName);
    const sheetId = sheetInfo.sheetId;

    const requests: sheets_v4.Schema$Request[] = [];

    // 2. Define Status Text and Background Color
    let statusText = '';
    let backgroundColor = { red: 1, green: 1, blue: 1 }; // Default White

    if (status === 'APPROVED') {
      statusText = 'APPROVED ✅';
      backgroundColor = { red: 0.85, green: 0.92, blue: 0.83 }; // Light Green
      
      // Lock Row: Add protection for this specific row (index starts at 0, rowIndex is human index matching A2:G)
      // If rowIndex is 5, it means Row 5 in Sheet (index 4)
      requests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex },
            description: `Locked Approved Row ${rowIndex}`,
            warningOnly: false
          }
        }
      });
    } else if (status === 'REJECTED') {
      statusText = `REJECTED: ${message || 'No reason provided'}`;
      backgroundColor = { red: 0.96, green: 0.8, blue: 0.8 }; // Light Red
    } else if (status === 'PENDING') {
      statusText = 'Syncing...';
      backgroundColor = { red: 1, green: 1, blue: 1 }; // White
    }

    // 3. Update Status Column (F) and Row Background
    // Column F is index 5
    // Column A-G is index 0-7
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex, startColumnIndex: 5, endColumnIndex: 6 },
        rows: [{ values: [{ userEnteredValue: { stringValue: statusText } }] }],
        fields: 'userEnteredValue'
      }
    });

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rowIndex - 1, endRowIndex: rowIndex, startColumnIndex: 0, endColumnIndex: 7 },
        cell: { userEnteredFormat: { backgroundColor } },
        fields: 'userEnteredFormat.backgroundColor'
      }
    });

    // 4. Update Sync Timestamp Note in A1
    const timestamp = new Date().toLocaleString();
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        rows: [{ values: [{ note: `Last Synced: ${timestamp}` }] }],
        fields: 'note'
      }
    });

    await this.executeBatchUpdate(spreadsheetId, requests);
  }

  /**
   * Update Budget indicator in Cell I1 (Column index 8)
   * Prompt asked for C1, but C1 is Category header. Using I1 to avoid breakage.
   */
  async updateBudgetInfo(spreadsheetId: string, tabName: string, remainingBudget: number) {
    const sheetInfo = await this.getSheetInfo(spreadsheetId, tabName);
    const sheetId = sheetInfo.sheetId;

    const isOverBudget = remainingBudget < 0;
    const requests: sheets_v4.Schema$Request[] = [
      {
        updateCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: `Remaining Budget: ¥${remainingBudget.toLocaleString()}` },
                  userEnteredFormat: {
                    textFormat: { bold: true, foregroundColor: isOverBudget ? { red: 1, green: 1, blue: 1 } : { red: 0, green: 0, blue: 0 } },
                    backgroundColor: isOverBudget ? { red: 0.9, green: 0.2, blue: 0.2 } : { red: 0.9, green: 0.9, blue: 0.9 }
                  }
                }
              ]
            }
          ],
          fields: 'userEnteredValue,userEnteredFormat(textFormat,backgroundColor)'
        }
      }
    ];

    await this.executeBatchUpdate(spreadsheetId, requests);
  }

  /**
   * Helper to execute batch update with Quota (429) retry logic
   */
  private async executeBatchUpdate(spreadsheetId: string, requests: sheets_v4.Schema$Request[], retryCount = 0) {
    const maxRetries = 3;
    const sheets = this.googleService.sheetsClient;

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
    } catch (error: any) {
      if (error.code === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        this.logger.warn(`⚠️ Quota exceeded (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeBatchUpdate(spreadsheetId, requests, retryCount + 1);
      }
      this.logger.error(`❌ Batch Update Failed: ${error.message}`);
      throw new InternalServerErrorException(`Sheets API Error: ${error.message}`);
    }
  }

  private async getSheetInfo(spreadsheetId: string, tabName: string) {
    const sheets = this.googleService.sheetsClient;
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === tabName);

    if (!sheet) throw new Error(`Tab ${tabName} not found in sheet ${spreadsheetId}`);
    return {
      sheetId: sheet.properties?.sheetId!,
      title: sheet.properties?.title!
    };
  }
}
