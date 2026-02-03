-- מיגרציה: התראות חוסר התאמה במשלוחים (לקניין)
--חסנאי מקבל משלוח מפקודת רכש ויש שינוי בכמויות/פריטים – הקניין מקבל התראה

-- טבלת התראות חוסר התאמה
CREATE TABLE IF NOT EXISTS receipt_discrepancy_alerts (
    id                  SERIAL PRIMARY KEY,
    warehouse_id        INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    shopping_list_id    INT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    warehouse_name      VARCHAR(255),
    order_number        INT,
    list_name           VARCHAR(255),
    details             JSONB NOT NULL DEFAULT '{}',
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_discrepancy_warehouse ON receipt_discrepancy_alerts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_receipt_discrepancy_list ON receipt_discrepancy_alerts(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_receipt_discrepancy_read ON receipt_discrepancy_alerts(read_at);
CREATE INDEX IF NOT EXISTS idx_receipt_discrepancy_created ON receipt_discrepancy_alerts(created_at DESC);
