-- מיגרציה: הוספת מספר סידורי (order_number) לרשימות קנייה – מתחיל מ-1000
-- הרץ רק אם הרצת את הסכמה הישנה לפני הוספת order_number.

SET client_encoding = 'UTF8';

CREATE SEQUENCE IF NOT EXISTS shopping_list_order_number_seq START 1000;

ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS order_number INT UNIQUE;

-- ערך ברירת מחדל שורות חדשות
ALTER TABLE shopping_lists
  ALTER COLUMN order_number SET DEFAULT nextval('shopping_list_order_number_seq');

-- מילוי ערכים לרשימות קיימות (אם יש)
DO $$
DECLARE
  r RECORD;
  n INT := 1000;
BEGIN
  FOR r IN SELECT id FROM shopping_lists WHERE order_number IS NULL ORDER BY id
  LOOP
    UPDATE shopping_lists SET order_number = n WHERE id = r.id;
    n := n + 1;
  END LOOP;
  PERFORM setval('shopping_list_order_number_seq', GREATEST(n, 1000));
END $$;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_order_number ON shopping_lists(order_number);
