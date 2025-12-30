-- AlterTable
ALTER TABLE "staging_transactions" ADD COLUMN     "isMissingReceipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "thumbnailUrl" TEXT;
