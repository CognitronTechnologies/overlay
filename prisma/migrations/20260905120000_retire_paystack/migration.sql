-- Retire Paystack payout destinations. These columns stored Paystack-specific
-- bank recipient data and are no longer collected or used.
UPDATE "Tipster"
SET "payoutMethod" = NULL
WHERE "payoutMethod" = 'paystack';

ALTER TABLE "Tipster"
  DROP COLUMN "payoutBankAccount",
  DROP COLUMN "payoutBankCode",
  DROP COLUMN "payoutAccountName";
