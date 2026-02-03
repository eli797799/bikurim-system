import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, sort_order, created_at FROM categories ORDER BY sort_order, name'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
