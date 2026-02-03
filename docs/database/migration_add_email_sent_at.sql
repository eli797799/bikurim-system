-- מיגרציה: הוספת עמודת email_sent_at (מתי נשלח המייל לספק) לטבלת shopping_lists
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_email_sent ON shopping_lists(email_sent_at);
