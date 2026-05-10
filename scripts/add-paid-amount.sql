ALTER TABLE loans ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

UPDATE loans l
SET paid_amount = (
  SELECT COALESCE(SUM(p.amount), 0)
  FROM payments p
  WHERE p.loan_id = l.id AND p.status = 'approved'
);
