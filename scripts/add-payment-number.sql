-- Add column if not exists
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number VARCHAR(20) UNIQUE AFTER id;

-- Backfill existing payments that have no payment_number
SET @row = 0;
UPDATE payments
SET payment_number = CONCAT('PAY-', YEAR(created_at), '-', LPAD((@row := @row + 1), 5, '0'))
WHERE payment_number IS NULL
ORDER BY created_at ASC;
