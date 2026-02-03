import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, email, full_name, role, is_active FROM users WHERE is_active = true ORDER BY COALESCE(full_name, email), email`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
