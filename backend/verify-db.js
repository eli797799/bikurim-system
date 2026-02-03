#!/usr/bin/env node
/**
 * בודק שכל הטבלאות והעמודות שהקוד משתמש בהן קיימות במסד הנתונים.
 * Run: node backend/verify-db.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const REQUIRED = {
  users: ['id', 'email', 'full_name', 'role', 'warehouse_id'],
  suppliers: ['id', 'name', 'email', 'status'],
  categories: ['id', 'name'],
  products: ['id', 'name', 'code', 'default_unit', 'category_id'],
  supplier_products: ['id', 'supplier_id', 'product_id', 'price_per_unit', 'unit_of_measure'],
  shopping_lists: ['id', 'order_number', 'name', 'list_date', 'notes', 'status', 'warehouse_id', 'email_sent_at', 'created_by', 'created_at', 'updated_at'],
  shopping_list_items: ['id', 'shopping_list_id', 'product_id', 'quantity', 'unit_of_measure', 'selected_supplier_id', 'price_at_selection', 'sort_order'],
  price_history: ['id', 'supplier_product_id', 'price_per_unit'],
  warehouses: ['id', 'name', 'code', 'address', 'location', 'is_active', 'responsible_user_id'],
  warehouse_inventory: ['id', 'warehouse_id', 'product_id', 'quantity', 'unit_of_measure', 'min_quantity', 'last_updated_at'],
  inventory_movements: ['id', 'warehouse_id', 'product_id', 'movement_type', 'quantity', 'movement_date', 'source_type', 'reference_id', 'created_at'],
  receipt_discrepancy_alerts: ['id', 'warehouse_id', 'shopping_list_id', 'details', 'read_at', 'created_at'],
  forecast_analysis: ['id', 'product_id', 'forecast_days', 'risk', 'explanation', 'analyzed_at'],
};

async function getTableColumns(client) {
  const r = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [Object.keys(REQUIRED)]);
  const byTable = {};
  for (const row of r.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row.column_name);
  }
  return byTable;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('חסר DATABASE_URL ב-.env');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    const existing = await getTableColumns(client);
    let hasError = false;
    for (const [table, requiredCols] of Object.entries(REQUIRED)) {
      const cols = existing[table] || [];
      const missing = requiredCols.filter((c) => !cols.includes(c));
      if (cols.length === 0) {
        console.error(`טבלה חסרה: ${table}`);
        hasError = true;
      } else if (missing.length > 0) {
        console.error(`טבלה ${table} – עמודות חסרות: ${missing.join(', ')}`);
        hasError = true;
      } else {
        console.log(`OK: ${table}`);
      }
    }
    if (hasError) {
      process.exit(1);
    }
    console.log('\nכל הטבלאות והעמודות הנדרשות קיימות.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
