/*
  Warnings:

  - You are about to alter the column `total_borrowed` on the `daily_snapshots` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.
  - You are about to alter the column `avg_apr` on the `daily_snapshots` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.
  - You are about to alter the column `accrued_amt` on the `interest_accruals` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.
  - You are about to alter the column `actual_apr` on the `interest_accruals` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.
  - You are about to alter the column `capped_apr` on the `interest_accruals` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.
  - You are about to alter the column `excess_amt` on the `interest_accruals` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.
  - You are about to alter the column `lltv` on the `markets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.
  - You are about to alter the column `apr_cap` on the `markets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.
  - You are about to alter the column `principal` on the `positions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.
  - You are about to alter the column `collateral` on the `positions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.
  - You are about to alter the column `amount` on the `reimbursements` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(78,0)`.

*/
-- DropForeignKey
ALTER TABLE "daily_snapshots" DROP CONSTRAINT "daily_snapshots_market_id_fkey";

-- DropForeignKey
ALTER TABLE "interest_accruals" DROP CONSTRAINT "interest_accruals_position_id_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_borrower_id_fkey";

-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_market_id_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_position_id_fkey";

-- AlterTable
ALTER TABLE "daily_snapshots" ALTER COLUMN "total_borrowed" SET DATA TYPE DECIMAL(78,0),
ALTER COLUMN "avg_apr" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "interest_accruals" ALTER COLUMN "accrued_amt" SET DATA TYPE DECIMAL(78,0),
ALTER COLUMN "actual_apr" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "capped_apr" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "excess_amt" SET DATA TYPE DECIMAL(78,0);

-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "lltv" SET DATA TYPE DECIMAL(10,4),
ALTER COLUMN "apr_cap" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "principal" SET DATA TYPE DECIMAL(78,0),
ALTER COLUMN "collateral" SET DATA TYPE DECIMAL(78,0);

-- AlterTable
ALTER TABLE "reimbursements" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(78,0);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "market_id" TEXT,
    "market_name" TEXT,
    "borrower_address" TEXT,
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_type_idx" ON "alerts"("type");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_acknowledged_idx" ON "alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "alerts_created_at_idx" ON "alerts"("created_at");

-- CreateIndex
CREATE INDEX "alerts_market_id_idx" ON "alerts"("market_id");

-- CreateIndex
CREATE INDEX "daily_snapshots_market_id_idx" ON "daily_snapshots"("market_id");

-- CreateIndex
CREATE INDEX "daily_snapshots_date_idx" ON "daily_snapshots"("date");

-- CreateIndex
CREATE INDEX "interest_accruals_position_id_idx" ON "interest_accruals"("position_id");

-- CreateIndex
CREATE INDEX "interest_accruals_date_idx" ON "interest_accruals"("date");

-- CreateIndex
CREATE INDEX "positions_borrower_id_idx" ON "positions"("borrower_id");

-- CreateIndex
CREATE INDEX "positions_market_id_idx" ON "positions"("market_id");

-- CreateIndex
CREATE INDEX "positions_is_active_idx" ON "positions"("is_active");

-- CreateIndex
CREATE INDEX "positions_borrower_id_market_id_is_active_idx" ON "positions"("borrower_id", "market_id", "is_active");

-- CreateIndex
CREATE INDEX "reimbursements_position_id_idx" ON "reimbursements"("position_id");

-- CreateIndex
CREATE INDEX "reimbursements_date_idx" ON "reimbursements"("date");

-- CreateIndex
CREATE INDEX "reimbursements_status_idx" ON "reimbursements"("status");

-- CreateIndex
CREATE INDEX "reimbursements_date_status_idx" ON "reimbursements"("date", "status");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_accruals" ADD CONSTRAINT "interest_accruals_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
