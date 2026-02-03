import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, warehouse_id, shopping_list_id, warehouse_name, order_number, list_name, details, read_at, created_at
       FROM receipt_discrepancy_alerts
       ORDER BY read_at NULLS FIRST, created_at DESC`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await query(
      `UPDATE receipt_discrepancy_alerts SET read_at = NOW() WHERE id = $1
       RETURNING id, warehouse_id, shopping_list_id, warehouse_name, order_number, list_name, details, read_at, created_at`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'התראה לא נמצאה' });
    res.json(r.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
