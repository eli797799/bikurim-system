-- מיגרציה: הוספת סטטוס לפקודות רכש (רשימות קנייה)
-- טיוטה | מאושרת | בוצעה

SET client_encoding = 'UTF8';

ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'approved', 'completed'));

UPDATE shopping_lists SET status = 'draft' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_status ON shopping_lists(status);
