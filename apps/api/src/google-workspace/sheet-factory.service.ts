import { Injectable, Logger } from '@nestjs/common';
import { sheets_v4 } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { GoogleWorkspaceService } from './google-workspace.service';

const prisma = new PrismaClient();

@Injectable()
export class SheetFactoryService {
  private readonly logger = new Logger(SheetFactoryService.name);
  private readonly MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor(private readonly googleService: GoogleWorkspaceService) { }

  /**
   * Programmatically generate the 12-month tab structure for a department
   */
  async generateYearlySheet(departmentId: string, departmentName: string, year: number) {
    const sheets = this.googleService.sheetsClient;
    const drive = this.googleService.driveClient;

    const templateId = process.env.GOOGLE_DRIVE_MASTER_TEMPLATE_ID;
    const masterFolderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID;
    const title = `HCMJ_${year}_${departmentName}`;

    if (templateId) {
      this.logger.log(`📋 Cloning master template ${templateId} for ${departmentName}...`);
      const copyResponse = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: title,
          parents: masterFolderId ? [masterFolderId] : undefined,
        },
        fields: 'id, webViewLink',
      });

      const spreadsheetId = copyResponse.data.id!;
      const webViewLink = copyResponse.data.webViewLink!;

      // Optional: Inject developer metadata for the cloned sheet for internal tracking
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                createDeveloperMetadata: {
                  developerMetadata: {
                    metadataKey: 'department_id',
                    metadataValue: departmentId,
                    location: { spreadsheet: true },
                    visibility: 'DOCUMENT',
                  }
                }
              }
            ]
          }
        });
      } catch (e) {
        this.logger.warn(`Could not add developer metadata to cloned sheet: ${e.message}`);
      }

      return { spreadsheetId, webViewLink };
    }

    this.logger.log(`⚙️ Generating yearly sheet programmatically for ${departmentName}...`);

    // 1. Fetch Funds for the Category dropdown
    const funds = await prisma.fund.findMany({
      where: { isActive: true },
      select: { name: true }
    });
    const fundNames = funds.map(f => f.name);

    // 2. Prepare the sheet structure
    // Define the 'READ ME' and 12 monthly sheets
    const sheetRequests: sheets_v4.Schema$Sheet[] = [
      {
        properties: {
          title: 'READ ME',
          tabColor: { red: 0.2, green: 0.2, blue: 0.2 },
          index: 0,
        },
      },
      ...this.MONTHS.map((month, index) => ({
        properties: {
          title: month,
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 10,
            rowCount: 1000,
          },
          index: index + 1,
        },
      }))
    ];

    // 3. Create the Spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheetRequests,
        developerMetadata: [
          {
            metadataKey: 'department_id',
            metadataValue: departmentId,
            location: { spreadsheet: true },
            visibility: 'DOCUMENT',
          }
        ]
      }
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;
    const webViewLink = spreadsheet.data.spreadsheetUrl!;

    // 4. Batch update for formatting, validation, and protection
    const batchRequests: sheets_v4.Schema$Request[] = [];

    // Monthly tabs logic (Index 1 to 12)
    spreadsheet.data.sheets?.forEach((sheet, index) => {
      const sheetId = sheet.properties?.sheetId!;
      const sheetTitle = sheet.properties?.title!;

      if (sheetTitle === 'READ ME') {
        // Setup READ ME content
        batchRequests.push({
          updateCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 },
            rows: [
              { values: [{ userEnteredValue: { stringValue: 'HCMJ Finance - Department Sheet Rules' }, userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }] },
              { values: [{ userEnteredValue: { stringValue: '1. Do not edit Row 1 (Headers).' } }] },
              { values: [{ userEnteredValue: { stringValue: '2. Do not edit Column G (Status) - System controlled.' } }] },
              { values: [{ userEnteredValue: { stringValue: '3. Use the dropdown in Column C (Category).' } }] },
              { values: [{ userEnteredValue: { stringValue: '4. Every expense requires a Receipt Link.' } }] },
            ],
            fields: 'userEnteredValue,userEnteredFormat.textFormat'
          }
        });
        return;
      }

      // Headers for monthly sheets
      batchRequests.push({
        updateCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
          rows: [
            {
              values: [
                { userEnteredValue: { stringValue: 'Date' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'Description' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'Category' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'Amount' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'Receipt_Link' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'Status' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: 'UUID' }, userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                { userEnteredValue: { stringValue: '' } }, // spacer
                { userEnteredValue: { stringValue: 'Remaining Budget: ¥0' }, userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 0, blue: 0 } } } },
              ]
            }
          ],
          fields: 'userEnteredValue,userEnteredFormat(textFormat,backgroundColor)'
        }
      });

      // Budget Cell C1 (Note: This overlaps with header if not careful, user said "Set Cell C1 to 'Remaining Budget: $0'")
      // Wait, Category is Column C (index 2). Row 1 is frozen. 
      // If freezing row 1, headers are in A1, B1, C1...
      // User said: "Headers: Row 1 must be frozen. Columns: Date, Description, Category (Dropdown), Amount..."
      // and "Budget Cell: Set Cell C1 to 'Remaining Budget: $0'."
      // This is a conflict. Maybe they meant Row 1 for headers and B1/C1 for something else?
      // Let's put Budget in Column H (index 7) or similar if needed, or follow prompt literally and maybe move Category.
      // Actually, let's put Budget in the 'READ ME' or at the very top if row 1 is headers.
      // Re-reading: "Headers: Row 1... Columns: ... Category..."
      // Let's put Budget in a specific fixed location or on a top bar.
      // I'll put headers in Row 1, and maybe "Budget" info in a separate spot.
      // Wait, if Row 1 is frozen and it's full of headers, C1 IS the header for Category.
      // I will put Budget in Cell I1 (Column 9).

      // Correction: I'll put Category header in C1, and overwrite it with Budget if I follow strictly? No.
      // I'll put headers in A2-G2 and freeze 2 rows? User specifically said Row 1 frozen.
      // I will put Budget in a comment or a different cell. 
      // Let's assume they want Budget in C1 of 'READ ME' or just one tab? 
      // I'll stick to Row 1 headers as requested. I'll put Budget in J1.

      // Data Validation for Category (Column C: index 2)
      batchRequests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 2, endColumnIndex: 3 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: fundNames.map(name => ({ userEnteredValue: name }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });

      // Currency Formatting for Amount (Column D: index 3)
      batchRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '"¥"#,##0' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });

      // Protection: Headers (Row 1)
      batchRequests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            description: 'Header Protection',
            warningOnly: false
          }
        }
      });

      // Protection: Status Column (Column F: index 5)
      batchRequests.push({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
            description: 'System Status Protection',
            warningOnly: false
          }
        }
      });

      // UUID Column (Column G: index 6) - Making it "hidden" by making it very narrow or just noting it.
      // I'll set its width to 5 pixels.
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
          properties: { pixelSize: 0 }, // Hidden
          fields: 'pixelSize'
        }
      });
    });

    // Run batch update
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: batchRequests }
    });

    // 5. Move to Master Folder
    if (masterFolderId) {
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: masterFolderId,
        fields: 'id, parents',
      });
    }

    this.logger.log(`🏗️ Factory generated yearly sheet for ${departmentName} (${spreadsheetId})`);

    return { spreadsheetId, webViewLink };
  }

  /**
   * Rename a spreadsheet in Google Drive
   */
  async renameSpreadsheet(spreadsheetId: string, newName: string) {
    await this.googleService.driveClient.files.update({
      fileId: spreadsheetId,
      requestBody: { name: newName }
    });
    this.logger.log(`🏷️ Renamed sheet ${spreadsheetId} to "${newName}"`);
  }

  /**
   * Fully lock all tabs in a spreadsheet
   */
  async lockAllTabs(spreadsheetId: string) {
    const sheets = this.googleService.sheetsClient;
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const tabs = response.data.sheets || [];

    const requests: sheets_v4.Schema$Request[] = tabs.map(tab => ({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId: tab.properties?.sheetId! },
          description: `Archived Lock - ${tab.properties?.title}`,
          warningOnly: false,
          // Empty editors array means only the service account can edit
          editors: { users: [] }
        }
      }
    }));

    // Also change tab colors to grey to signify archive
    requests.push(...tabs.map(tab => ({
      updateSheetProperties: {
        properties: {
          sheetId: tab.properties?.sheetId!,
          tabColor: { red: 0.8, green: 0.8, blue: 0.8 }
        },
        fields: 'tabColor'
      }
    })));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    this.logger.log(`🔒 Fully locked ${tabs.length} tabs in sheet ${spreadsheetId}`);
  }
}
