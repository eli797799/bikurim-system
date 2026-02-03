-- =============================================================================
-- מערכת קניין ורשימות קנייה לביכורים – סכמת מסד נתונים
-- Cloud-based Procurement & Shopping Lists for Bikurim
-- Database: PostgreSQL | Encoding: UTF-8 (תמיכה מלאה בעברית)
-- =============================================================================

-- יצירת DB עם תמיכה ב-UTF-8 (בהרצה ידנית אם נדרש):
-- CREATE DATABASE bikurim_procurement ENCODING 'UTF8' LC_COLLATE='he_IL.UTF-8' LC_CTYPE='he_IL.UTF-8';

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 1. טבלת משתמשים (להרשאות: קניין / צפייה בלבד)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- -----------------------------------------------------------------------------
-- 2. טבלת ספקים
-- -----------------------------------------------------------------------------
CREATE TABLE suppliers (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    tax_id              VARCHAR(50),                    -- ח.פ / מזהה
    contact_person      VARCHAR(255),                  -- איש קשר
    phone               VARCHAR(50),
    email               VARCHAR(255),
    address             TEXT,                          -- כתובת
    payment_terms       VARCHAR(100),                  -- שוטף / מזומן / אחר
    notes               TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_tax_id ON suppliers(tax_id);

-- -----------------------------------------------------------------------------
-- 3. טבלת קטגוריות מוצרים (ירקות, פירות, יבש, קפוא וכו')
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_name ON categories(name);

-- -----------------------------------------------------------------------------
-- 4. טבלת מוצרים (מאגר כללי)
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    code                    VARCHAR(100),              -- קוד מוצר
    category_id             INT REFERENCES categories(id) ON DELETE SET NULL,
    default_unit            VARCHAR(50) NOT NULL,     -- יחידת מידה ברירת מחדל: ק"ג, יח', קרטון
    description             TEXT,                     -- תיאור קצר
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(code)
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category_id);

-- -----------------------------------------------------------------------------
-- 5. טבלת קשר ספק–מוצר (הלב של המערכת)
-- מוצר אחד → ספקים רבים, לכל ספק מחיר שונה
-- -----------------------------------------------------------------------------
CREATE TABLE supplier_products (
    id                      SERIAL PRIMARY KEY,
    supplier_id             INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id              INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    internal_code           VARCHAR(100),             -- קוד מוצר פנימי אצל הספק
    price_per_unit          DECIMAL(12, 4) NOT NULL CHECK (price_per_unit >= 0),
    unit_of_measure        VARCHAR(50) NOT NULL,      -- ק"ג / יח' / קרטון
    min_order_quantity     DECIMAL(12, 4),           -- מינימום הזמנה (אם יש)
    last_price_update      DATE,                     -- תאריך עדכון מחיר אחרון
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(supplier_id, product_id)
);

CREATE INDEX idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_product ON supplier_products(product_id);
CREATE INDEX idx_supplier_products_price ON supplier_products(product_id, price_per_unit);

-- -----------------------------------------------------------------------------
-- 6. טבלת פקודות רכש (רשימות קנייה)
-- מספר סידורי ייחודי (Order Number) מתחיל מ-1000, לעולם לא חוזר
-- סטטוס: draft (טיוטה), approved (מאושרת), completed (בוצעה)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE shopping_list_order_number_seq START 1000;

CREATE TABLE shopping_lists (
    id              SERIAL PRIMARY KEY,
    order_number    INT NOT NULL UNIQUE DEFAULT nextval('shopping_list_order_number_seq'),
    name            VARCHAR(255) NOT NULL,            -- שם הפקודה (למשל: קניית ביכורים – יום א')
    list_date       DATE NOT NULL,
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'completed')),
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopping_lists_order_number ON shopping_lists(order_number);
CREATE INDEX idx_shopping_lists_date ON shopping_lists(list_date);
CREATE INDEX idx_shopping_lists_status ON shopping_lists(status);
CREATE INDEX idx_shopping_lists_created_by ON shopping_lists(created_by);

-- -----------------------------------------------------------------------------
-- 7. טבלת פריטים ברשימת קנייה
-- שומרת את המוצר, הכמות, והספק שנבחר + המחיר בזמן הבחירה (snapshot)
-- -----------------------------------------------------------------------------
CREATE TABLE shopping_list_items (
    id                  SERIAL PRIMARY KEY,
    shopping_list_id    INT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    product_id          INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity            DECIMAL(12, 4) NOT NULL CHECK (quantity > 0),
    unit_of_measure     VARCHAR(50) NOT NULL,
    selected_supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,  -- הספק שנבחר (זול ביותר או ידני)
    price_at_selection  DECIMAL(12, 4),               -- המחיר שהיה נכון לרגע השיבוץ (חובה אם נבחר ספק)
    sort_order          INT NOT NULL DEFAULT 0,       -- סדר הצגה ברשימה
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_price_when_supplier CHECK (
        (selected_supplier_id IS NULL AND price_at_selection IS NULL) OR
        (selected_supplier_id IS NOT NULL AND price_at_selection IS NOT NULL AND price_at_selection >= 0)
    )
);

CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_product ON shopping_list_items(product_id);
CREATE INDEX idx_shopping_list_items_supplier ON shopping_list_items(selected_supplier_id);

-- -----------------------------------------------------------------------------
-- 8. (אופציונלי – שלב מתקדם) היסטוריית מחירים לדוחות
-- -----------------------------------------------------------------------------
CREATE TABLE price_history (
    id                  SERIAL PRIMARY KEY,
    supplier_product_id INT NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
    price_per_unit      DECIMAL(12, 4) NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_supplier_product ON price_history(supplier_product_id);
CREATE INDEX idx_price_history_recorded ON price_history(recorded_at);

-- -----------------------------------------------------------------------------
-- Triggers: עדכון updated_at אוטומטי
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_supplier_products_updated_at BEFORE UPDATE ON supplier_products
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER tr_shopping_list_items_updated_at BEFORE UPDATE ON shopping_list_items
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- -----------------------------------------------------------------------------
-- נתוני התחלה (קטגוריות לדוגמה)
-- -----------------------------------------------------------------------------
INSERT INTO categories (name, sort_order) VALUES
    ('ירקות', 1),
    ('פירות', 2),
    ('יבש', 3),
    ('קפוא', 4),
    ('חלב וביצים', 5),
    ('אחר', 99);

-- =============================================================================
-- סוף סכמה
-- =============================================================================
