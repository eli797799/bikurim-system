-- =============================================================================
-- מיגרציה: ניהול מלאי רב־מחסני (חלק 7)
-- Migration: Multi-warehouse inventory management
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 1. הרחבת טבלת מחסנים: קוד מחסן, מיקום, מחסנאי אחראי
-- -----------------------------------------------------------------------------
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS responsible_user_id INT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouses_responsible_user ON warehouses(responsible_user_id);

-- -----------------------------------------------------------------------------
-- 2. הרחבת משתמשים: תפקיד מחסנאי + קישור למחסן
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_warehouse ON users(warehouse_id);

-- הרחבת תפקידים: admin, viewer, warehouse_worker
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'viewer', 'warehouse_worker'));

-- -----------------------------------------------------------------------------
-- 3. מלאי לפי מחסן (מוצר + כמות + מינימום להתראה)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_inventory (
    id                  SERIAL PRIMARY KEY,
    warehouse_id         INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id           INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity             DECIMAL(12, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_of_measure      VARCHAR(50) NOT NULL,
    min_quantity         DECIMAL(12, 4),                    -- כמות מינימום (התראה)
    last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON warehouse_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product ON warehouse_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_min ON warehouse_inventory(warehouse_id, min_quantity) WHERE min_quantity IS NOT NULL;

DROP TRIGGER IF EXISTS tr_warehouse_inventory_updated_at ON warehouse_inventory;
CREATE TRIGGER tr_warehouse_inventory_updated_at BEFORE UPDATE ON warehouse_inventory
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. יומן תנועות מלאי (כניסה/יציאה) – לא ניתן למחוק
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
    id                  SERIAL PRIMARY KEY,
    warehouse_id         INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id           INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type        VARCHAR(10) NOT NULL CHECK (movement_type IN ('in', 'out')),
    quantity             DECIMAL(12, 4) NOT NULL CHECK (quantity > 0),
    unit_of_measure      VARCHAR(50) NOT NULL,
    movement_date        DATE NOT NULL,
    user_id              INT REFERENCES users(id) ON DELETE SET NULL,
    source_type          VARCHAR(50),                        -- ספק / העברה פנימית / אחר
    reference_id         INT,                               -- מזהה ספק וכו'
    destination          VARCHAR(255),                       -- יעד (ליציאה): מפעל / ייצור / אחר
    note                 TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(warehouse_id, created_at DESC);
