import { Injectable, Logger } from '@nestjs/common';

/**
 * Privacy Service
 * GDPR compliance and data protection
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  // Fields that contain PII (Personally Identifiable Information)
  private readonly PII_FIELDS = [
    'donorName', 'donorEmail', 'donorPhone', 'donorAddress',
    'memberName', 'memberEmail', 'memberPhone',
    'fullName', 'email', 'phone', 'address'
  ];

  /**
   * Mask a name for display/export
   * "John Smith" -> "John S***"
   */
  maskName(name: string): string {
    if (!name || name.trim().length === 0) return '';
    
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      // Single name: show first char + ***
      return parts[0].charAt(0) + '***';
    }
    
    // Multiple parts: show first name + masked last name
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0);
    return `${firstName} ${lastNameInitial}***`;
  }

  /**
   * Mask an email address
   * "john.smith@example.com" -> "j***@example.com"
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '';
    
    const [local, domain] = email.split('@');
    const maskedLocal = local.charAt(0) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask a phone number
   * "123-456-7890" -> "***-***-7890"
   */
  maskPhone(phone: string): string {
    if (!phone) return '';
    
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    
    const lastFour = digits.slice(-4);
    return `***-***-${lastFour}`;
  }

  /**
   * Mask PII fields in an object for export
   */
  maskPiiForExport<T extends Record<string, unknown>>(data: T): T {
    const masked = { ...data } as Record<string, unknown>;

    for (const field of this.PII_FIELDS) {
      if (field in masked && masked[field]) {
        const value = masked[field] as string;
        if (field.toLowerCase().includes('email')) {
          masked[field] = this.maskEmail(value);
        } else if (field.toLowerCase().includes('phone')) {
          masked[field] = this.maskPhone(value);
        } else if (field.toLowerCase().includes('name')) {
          masked[field] = this.maskName(value);
        } else if (field.toLowerCase().includes('address')) {
          masked[field] = '[REDACTED]';
        }
      }
    }

    return masked as T;
  }

  /**
   * Mask array of records for export
   */
  maskArrayForExport<T extends Record<string, unknown>>(data: T[]): T[] {
    return data.map(item => this.maskPiiForExport(item));
  }

  /**
   * Check if a field contains PII
   */
  isPiiField(fieldName: string): boolean {
    return this.PII_FIELDS.some(pii => 
      fieldName.toLowerCase().includes(pii.toLowerCase())
    );
  }

  /**
   * Anonymize a record (for deletion requests)
   * Replaces PII with anonymized values instead of deleting
   */
  anonymizeRecord<T extends Record<string, unknown>>(data: T): T {
    const anonymized = { ...data } as Record<string, unknown>;

    for (const field of this.PII_FIELDS) {
      if (field in anonymized) {
        anonymized[field] = '[ANONYMIZED]';
      }
    }

    // Add anonymization metadata
    anonymized._anonymizedAt = new Date().toISOString();
    anonymized._anonymizationReason = 'GDPR_REQUEST';

    return anonymized as T;
  }

  /**
   * Get data retention policy
   */
  getRetentionPolicy(): {
    financialRecords: number;
    donorData: number;
    auditLogs: number;
    backups: number;
  } {
    return {
      financialRecords: 7 * 365, // 7 years (legal requirement)
      donorData: 3 * 365,        // 3 years after last donation
      auditLogs: 5 * 365,        // 5 years
      backups: 30,               // 30 days
    };
  }

  /**
   * Generate GDPR export for a user (data portability)
   */
  async generateGdprExport(userId: string): Promise<{
    personalData: any;
    donations: any[];
    activityLog: any[];
    exportDate: string;
  }> {
    // This would query the database for all user data
    // For now, return a template
    return {
      personalData: {
        note: 'Query user data from database',
      },
      donations: [],
      activityLog: [],
      exportDate: new Date().toISOString(),
    };
  }
}
