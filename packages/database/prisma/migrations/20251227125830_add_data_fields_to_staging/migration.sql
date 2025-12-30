/*
  Warnings:

  - Added the required column `amount` to the `staging_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "staging_transactions" ADD COLUMN     "amount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "receiptUrl" TEXT;
