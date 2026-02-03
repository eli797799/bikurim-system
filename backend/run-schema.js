import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const schemaPath = path.join(projectRoot, 'docs', 'database', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool
  .query(sql)
  .then(() => {
    console.log('Schema applied successfully. Tables created.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Schema failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
