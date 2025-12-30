-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'CASH', 'ONLINE', 'MOBILE', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TREASURER', 'AUDITOR', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "AnonymityLevel" AS ENUM ('NAMED', 'ANONYMOUS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "BeneficiaryCategory" AS ENUM ('WIDOW', 'ORPHAN', 'ELDERLY', 'DISABLED', 'UNEMPLOYED', 'STUDENT', 'REFUGEE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "SheetRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "StagingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "funds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "payee" TEXT,
    "description" TEXT NOT NULL,
    "referenceNo" TEXT,
    "receiptUrl" TEXT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "donorId" TEXT,
    "beneficiaryId" TEXT,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_splits" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "anonymityPreference" "AnonymityLevel" NOT NULL DEFAULT 'NAMED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "category" "BeneficiaryCategory" NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "privateIdentity" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "spent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fundId" TEXT NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetLimit" DECIMAL(14,2) NOT NULL,
    "headEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sheets" (
    "id" TEXT NOT NULL,
    "googleSheetId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,

    CONSTRAINT "external_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SheetRole" NOT NULL DEFAULT 'VIEWER',
    "isOrgEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalSheetId" TEXT NOT NULL,

    CONSTRAINT "sheet_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staging_transactions" (
    "id" TEXT NOT NULL,
    "sheetRowIndex" INTEGER NOT NULL,
    "rawDataHash" TEXT NOT NULL,
    "status" "StagingStatus" NOT NULL DEFAULT 'PENDING',
    "syncUuid" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalSheetId" TEXT NOT NULL,

    CONSTRAINT "staging_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowsProcessed" INTEGER NOT NULL,
    "status" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalSheetId" TEXT NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_requests" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funds_name_key" ON "funds"("name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_key" ON "accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceNo_key" ON "transactions"("referenceNo");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transaction_splits_transactionId_idx" ON "transaction_splits"("transactionId");

-- CreateIndex
CREATE INDEX "transaction_splits_fundId_idx" ON "transaction_splits"("fundId");

-- CreateIndex
CREATE UNIQUE INDEX "donors_donorId_key" ON "donors"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_beneficiaryId_key" ON "beneficiaries"("beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_fundId_month_year_key" ON "budgets"("fundId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "external_sheets_googleSheetId_key" ON "external_sheets"("googleSheetId");

-- CreateIndex
CREATE INDEX "external_sheets_googleSheetId_idx" ON "external_sheets"("googleSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "staging_transactions_syncUuid_key" ON "staging_transactions"("syncUuid");

-- CreateIndex
CREATE INDEX "staging_transactions_syncUuid_idx" ON "staging_transactions"("syncUuid");

-- CreateIndex
CREATE INDEX "staging_transactions_status_idx" ON "staging_transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_year_key" ON "fiscal_years"("year");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sheets" ADD CONSTRAINT "external_sheets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sheets" ADD CONSTRAINT "external_sheets_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_users" ADD CONSTRAINT "sheet_users_externalSheetId_fkey" FOREIGN KEY ("externalSheetId") REFERENCES "external_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_transactions" ADD CONSTRAINT "staging_transactions_externalSheetId_fkey" FOREIGN KEY ("externalSheetId") REFERENCES "external_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_externalSheetId_fkey" FOREIGN KEY ("externalSheetId") REFERENCES "external_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
