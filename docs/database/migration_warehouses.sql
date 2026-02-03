-- מיגרציה: טבלת מחסנים + שדה מחסן בפקודות רכש
-- Migration: warehouses table + warehouse_id on shopping_lists

-- (פונקציה קיימת בסכמה; אם רצים מיגרציה לבד – להריץ קודם את הסכמה או להסיר את הטריגר)
-- 1. טבלת מחסנים
CREATE TABLE IF NOT EXISTS warehouses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    notes       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON warehouses(is_active);

CREATE TRIGGER tr_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 2. שדה מחסן בפקודות רכש (לאיזה מחסן הוזמנה ההזמנה)
ALTER TABLE shopping_lists
    ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_warehouse ON shopping_lists(warehouse_id);
