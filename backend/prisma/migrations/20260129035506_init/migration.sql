-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "vault_address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collateral_asset" TEXT NOT NULL,
    "loan_asset" TEXT NOT NULL,
    "lltv" DECIMAL(65,30) NOT NULL,
    "apr_cap" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrowers" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "borrower_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "principal" DECIMAL(65,30) NOT NULL,
    "collateral" DECIMAL(65,30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_accruals" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accrued_amt" DECIMAL(65,30) NOT NULL,
    "actual_apr" DECIMAL(65,30) NOT NULL,
    "capped_apr" DECIMAL(65,30) NOT NULL,
    "excess_amt" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "interest_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_snapshots" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_borrowed" DECIMAL(65,30) NOT NULL,
    "avg_apr" DECIMAL(65,30) NOT NULL,
    "borrower_count" INTEGER NOT NULL,
    "above_cap_count" INTEGER NOT NULL,

    CONSTRAINT "daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_market_id_key" ON "markets"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_address_key" ON "borrowers"("address");

-- CreateIndex
CREATE UNIQUE INDEX "interest_accruals_position_id_date_key" ON "interest_accruals"("position_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_snapshots_market_id_date_key" ON "daily_snapshots"("market_id", "date");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_accruals" ADD CONSTRAINT "interest_accruals_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
