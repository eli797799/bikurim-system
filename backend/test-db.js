import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool
  .query('SELECT 1 as ok')
  .then((r) => {
    console.log('Connection OK:', r.rows[0]);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Connection failed:', e.message);
    process.exit(1);
  });
