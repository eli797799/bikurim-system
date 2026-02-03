#!/usr/bin/env node
/**
 * איפוס נתוני ניסיון – הכנה לפיילוט
 * מריץ את migration_reset_pilot_data.sql על מסד הנתונים
 *
 * שימוש: node run-reset-pilot.js
 * דרוש: .env עם DATABASE_URL
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('שגיאה: חסר DATABASE_URL בקובץ .env');
  process.exit(1);
}

const sqlPath = join(__dirname, '..', 'docs', 'database', 'migration_reset_pilot_data.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString: dbUrl });

async function run() {
  try {
    await client.connect();
    console.log('מתחבר למסד הנתונים...');
    await client.query(sql);
    console.log('איפוס הושלם בהצלחה.');
    console.log('  - הוסרו: suppliers, products, supplier_products, shopping_lists, shopping_list_items, price_history');
    console.log('  - נשמרו: categories, users');
    console.log('  - order_number ייתחל מחדש ל-1000');
  } catch (err) {
    console.error('שגיאה באיפוס:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
