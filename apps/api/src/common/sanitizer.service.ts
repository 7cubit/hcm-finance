import { Injectable, Logger } from '@nestjs/common';

/**
 * Sanitizer Service
 * Prevents CSV injection (formula injection) attacks
 * Applies to all user inputs before storage
 */
@Injectable()
export class SanitizerService {
  private readonly logger = new Logger(SanitizerService.name);

  // Characters that trigger formula execution in spreadsheet apps
  private readonly FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];
  
  // DDE (Dynamic Data Exchange) patterns
  private readonly DDE_PATTERNS = [
    /^=cmd\|/i,
    /^=HYPERLINK\(/i,
    /^=IMPORTXML\(/i,
    /^=IMPORTDATA\(/i,
    /^=IMPORTFEED\(/i,
    /^=IMPORTHTML\(/i,
    /^=IMPORTRANGE\(/i,
    /^=IMAGE\(/i,
  ];

  /**
   * Sanitize a single string value
   * Strips formula prefixes to prevent CSV injection
   */
  sanitizeString(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Remove formula prefixes
    while (this.FORMULA_PREFIXES.some(prefix => sanitized.startsWith(prefix))) {
      sanitized = sanitized.substring(1).trim();
    }

    // Check for DDE patterns
    for (const pattern of this.DDE_PATTERNS) {
      if (pattern.test(sanitized)) {
        this.logger.warn(`🚨 Blocked DDE injection attempt: ${input.substring(0, 50)}...`);
        sanitized = sanitized.replace(pattern, '[BLOCKED]');
      }
    }

    return sanitized;
  }

  /**
   * Sanitize an object's string properties
   */
  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized = { ...obj };
    
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.sanitizeString(sanitized[key]) as any;
      } else if (Array.isArray(sanitized[key])) {
        sanitized[key] = sanitized[key].map((item: any) => 
          typeof item === 'string' ? this.sanitizeString(item) : item
        ) as any;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a 2D array (spreadsheet data)
   */
  sanitizeSheetData(data: any[][]): any[][] {
    return data.map(row => 
      row.map(cell => 
        typeof cell === 'string' ? this.sanitizeString(cell) : cell
      )
    );
  }

  /**
   * Escape for CSV export (wrap in quotes, escape existing quotes)
   */
  escapeForCsv(value: string): string {
    const sanitized = this.sanitizeString(value);
    
    // If contains comma, quote, or newline, wrap in quotes
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    
    return sanitized;
  }

  /**
   * Generate safe CSV from data
   */
  generateSafeCsv(headers: string[], rows: any[][]): string {
    const safeHeaders = headers.map(h => this.escapeForCsv(h));
    const safeRows = rows.map(row => 
      row.map(cell => this.escapeForCsv(String(cell ?? '')))
    );

    return [
      safeHeaders.join(','),
      ...safeRows.map(row => row.join(','))
    ].join('\n');
  }
}
