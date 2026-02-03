#!/usr/bin/env node
/**
 * הרצת כל המיגרציות מהשיחה (מחסנים + מלאי רב־מחסני)
 * Run: node backend/run-all-migrations.js
 * דורש: .env עם DATABASE_URL
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const migrations = [
  'migration_warehouses.sql',
  'migration_purchase_order_status.sql',
  'migration_add_order_number.sql',
  'migration_inventory_multiple_warehouses.sql',
  'migration_receipt_discrepancy_alerts.sql',
  'migration_add_email_sent_at.sql',
  'migration_forecast_analysis.sql',
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('חסר DATABASE_URL ב-.env');
    process.exit(1);
  }
  for (const name of migrations) {
    const filePath = path.join(projectRoot, 'docs', 'database', name);
    if (!fs.existsSync(filePath)) {
      console.warn('דילוג – קובץ לא נמצא:', name);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(sql);
      console.log('OK:', name);
    } catch (err) {
      console.error('שגיאה ב-' + name + ':', err.message);
      process.exit(1);
    }
  }
  console.log('כל המיגרציות הורצו בהצלחה.');
  process.exit(0);
}

run().finally(() => pool.end());
