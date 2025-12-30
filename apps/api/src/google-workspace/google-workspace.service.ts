import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { google, sheets_v4, drive_v3 } from 'googleapis';

/**
 * GOOGLE WORKSPACE ARCHITECTURE FOR HCMJ FINANCE
 *
 * === SETUP INSTRUCTIONS ===
 *
 * 1. Enable APIs in GCP Console (https://console.cloud.google.com):
 *    - Google Sheets API
 *    - Google Drive API
 *    - Google Picker API (for frontend file selection)
 *
 * 2. Create Service Account:
 *    Go to: IAM & Admin > Service Accounts > Create Service Account
 *    Name: sheet-manager
 *    Email: sheet-manager@hcmj-finance.iam.gserviceaccount.com
 *
 * 3. Grant Domain-Wide Delegation (CRITICAL for G Suite):
 *    a) In GCP: Service Account > Keys > Add Key > Create new key (JSON)
 *    b) In GCP: Service Account > Edit > Enable "Domain-wide delegation"
 *    c) Copy the "Client ID" (numeric)
 *    d) In Google Admin Console (admin.google.com):
 *       - Security > API Controls > Domain-wide delegation > Add new
 *       - Client ID: [paste the numeric Client ID]
 *       - OAuth Scopes:
 *         https://www.googleapis.com/auth/spreadsheets
 *         https://www.googleapis.com/auth/drive.file
 *         https://www.googleapis.com/auth/drive.metadata
 *
 * 4. Create Master Finance Folder:
 *    - Create manually or use createMasterFolder() below
 *    - Share with: sheet-manager@hcmj-finance.iam.gserviceaccount.com (Editor)
 *    - Copy folder ID to .env: GOOGLE_DRIVE_MASTER_FOLDER_ID
 *
 * 5. Store Credentials Safely:
 *    Option A (Development): GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env
 *    Option B (Production): Use Secret Manager
 *
 * === NAMING CONVENTION ===
 * HCMJ_[Year]_[DeptName]_[SecretID]
 * Example: HCMJ_2025_Treasurer_abc123
 */

interface GoogleWorkspaceConfig {
  serviceAccountKeyPath?: string;
  serviceAccountKey?: string; // JSON string (from Secret Manager)
  serviceAccountEmail?: string;
  masterFolderId: string;
  adminEmail?: string; // For domain-wide delegation impersonation
}

@Injectable()
export class GoogleWorkspaceService implements OnModuleInit {
  private readonly logger = new Logger(GoogleWorkspaceService.name);
  private sheets: sheets_v4.Sheets;
  private drive: drive_v3.Drive;
  public config: GoogleWorkspaceConfig;

  async onModuleInit() {
    await this.initialize();
  }

  get sheetsClient(): sheets_v4.Sheets {
    return this.sheets;
  }

  get driveClient(): drive_v3.Drive {
    return this.drive;
  }

  /**
   * Initialize Google APIs with Service Account
   */
  async initialize(): Promise<void> {
    this.config = {
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      masterFolderId: process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID || '',
      adminEmail: process.env.GOOGLE_ADMIN_EMAIL,
    };

    try {
      // Authenticate with Service Account
      const auth = await this.getAuthClient();

      this.sheets = google.sheets({ version: 'v4', auth });
      this.drive = google.drive({ version: 'v3', auth });

      this.logger.log('✅ Google Workspace APIs initialized');

      // Verify access on startup
      if (this.config.masterFolderId) {
        await this.verifyDriveAccess();
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize Google Workspace:', error);
    }
  }

  /**
   * Get authenticated client (Service Account with optional impersonation)
   */
  private async getAuthClient() {
    let keyFile: any;

    if (this.config.serviceAccountKey) {
      // From Secret Manager or environment variable
      keyFile = JSON.parse(this.config.serviceAccountKey);
    } else if (this.config.serviceAccountKeyPath) {
      // From file path (development)
      keyFile = require(this.config.serviceAccountKeyPath);
    } else {
      throw new Error('No Google Service Account credentials provided');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata',
      ],
      // For domain-wide delegation, impersonate an admin user
      ...(this.config.adminEmail && {
        clientOptions: {
          subject: this.config.adminEmail,
        },
      }),
    });

    return auth;
  }

  /**
   * Verify Drive Access - List files in Master Folder
   */
  async verifyDriveAccess(): Promise<{ success: boolean; files: string[] }> {
    try {
      const response = await this.drive.files.list({
        q: `'${this.config.masterFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
        pageSize: 100,
      });

      const files = response.data.files || [];
      this.logger.log(`✅ Drive access verified. Found ${files.length} files in Master Folder`);

      return {
        success: true,
        files: files.map((f) => f.name || 'Unnamed'),
      };
    } catch (error: any) {
      this.logger.error(`❌ Drive access failed: ${error.message}`);
      return { success: false, files: [] };
    }
  }

  /**
   * Generate sheet name using convention: HCMJ_[Year]_[DeptName]_[SecretID]
   */
  generateSheetName(deptName: string, secretId?: string): string {
    const year = new Date().getFullYear();
    const id = secretId || Math.random().toString(36).substring(2, 8);
    return `HCMJ_${year}_${deptName}_${id}`;
  }

  /**
   * Create a new spreadsheet in Master Folder
   */
  async createSpreadsheet(title: string, shareWithEmail?: string): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  }> {
    // 1. Create the spreadsheet
    const spreadsheet = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          { properties: { title: 'Summary' } },
          { properties: { title: 'Transactions' } },
          { properties: { title: 'Donors' } },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl!;

    // 2. Move to Master Folder
    if (this.config.masterFolderId) {
      await this.drive.files.update({
        fileId: spreadsheetId,
        addParents: this.config.masterFolderId,
        fields: 'id, parents',
      });
    }

    // 3. Share with specific email if provided
    if (shareWithEmail) {
      await this.shareFile(spreadsheetId, shareWithEmail, 'writer');
    }

    this.logger.log(`📊 Created spreadsheet: ${title} (${spreadsheetId})`);

    return { spreadsheetId, spreadsheetUrl };
  }

  /**
   * Share a file with a specific email
   */
  async shareFile(
    fileId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader',
  ): Promise<void> {
    await this.drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
      sendNotificationEmail: false,
    });

    this.logger.log(`📤 Shared file ${fileId} with ${email} (${role})`);
  }

  /**
   * Write data to a spreadsheet
   */
  async writeToSheet(
    spreadsheetId: string,
    range: string,
    values: any[][],
  ): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }

  /**
   * Read data from a spreadsheet
   */
  async readFromSheet(
    spreadsheetId: string,
    range: string,
  ): Promise<any[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || [];
  }

  /**
   * Create Master Finance Folder (run once during setup)
   */
  async createMasterFolder(folderName: string = 'HCMJ Finance Master'): Promise<string> {
    const folder = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const folderId = folder.data.id!;
    this.logger.log(`📁 Created Master Folder: ${folderId}`);
    this.logger.log('⚠️  Add this to .env: GOOGLE_DRIVE_MASTER_FOLDER_ID=' + folderId);

    return folderId;
  }

  /**
   * Export spreadsheet report (Monthly/Annual)
   */
  async exportMonthlyReport(
    year: number,
    month: number,
    data: {
      income: any[];
      expenses: any[];
      summary: any;
    },
  ): Promise<{ spreadsheetId: string; url: string }> {
    const sheetName = this.generateSheetName(`Monthly_${year}_${month}`);
    const { spreadsheetId, spreadsheetUrl } = await this.createSpreadsheet(sheetName);

    // Summary sheet
    await this.writeToSheet(spreadsheetId, 'Summary!A1', [
      ['HCMJ Finance - Monthly Report'],
      [`Period: ${year}/${month}`],
      [''],
      ['Total Income', data.summary.totalIncome],
      ['Total Expenses', data.summary.totalExpenses],
      ['Net', data.summary.totalIncome - data.summary.totalExpenses],
    ]);

    // Transactions sheet
    await this.writeToSheet(spreadsheetId, 'Transactions!A1', [
      ['Date', 'Type', 'Amount', 'Description', 'Fund', 'Account'],
      ...data.income.map((i) => [i.date, 'Income', i.amount, i.description, i.fund, i.account]),
      ...data.expenses.map((e) => [e.date, 'Expense', e.amount, e.description, e.fund, e.account]),
    ]);

    return { spreadsheetId, url: spreadsheetUrl };
  }
}
