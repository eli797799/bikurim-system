import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { category_id, q } = req.query;
    let sql = `
      SELECT p.id, p.name, p.code, p.category_id, c.name AS category_name, p.default_unit, p.description, p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (category_id) {
      sql += ` AND p.category_id = $${i++}`;
      params.push(category_id);
    }
    if (q && q.trim()) {
      sql += ` AND (p.name ILIKE $${i} OR p.code ILIKE $${i})`;
      params.push(`%${q.trim()}%`);
      i++;
    }
    sql += ' ORDER BY p.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await query(
      `SELECT p.id, p.name, p.code, p.category_id, c.name AS category_name, p.default_unit, p.description, p.created_at, p.updated_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [id]
    );
    if (product.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const suppliers = await query(
      `SELECT sp.id, sp.supplier_id, s.name AS supplier_name, sp.price_per_unit, sp.unit_of_measure,
              sp.min_order_quantity, sp.last_price_update,
              (sp.price_per_unit = (SELECT MIN(price_per_unit) FROM supplier_products WHERE product_id = $1)) AS is_cheapest
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.product_id = $1 AND s.status = 'active'
       ORDER BY sp.price_per_unit ASC`,
      [id]
    );
    res.json({ ...product.rows[0], suppliers: suppliers.rows });
  } catch (err) {
    next(err);
  }
});

const DEFAULT_UNIT = "יח'";

router.post('/', async (req, res, next) => {
  try {
    const { name, code, category_id, default_unit, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'שם מוצר חובה' });
    const unit = (default_unit && String(default_unit).trim()) ? String(default_unit).trim() : DEFAULT_UNIT;
    const result = await query(
      `INSERT INTO products (name, code, category_id, default_unit, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, code, category_id, default_unit, description, created_at, updated_at`,
      [name.trim(), code || null, category_id || null, unit, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'קוד מוצר כבר קיים' });
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, category_id, default_unit, description } = req.body;
    const params = [id];
    const sets = [];
    let i = 2;
    if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name); }
    if (code !== undefined) { sets.push(`code = $${i++}`); params.push(code); }
    if (category_id !== undefined) { sets.push(`category_id = $${i++}`); params.push(category_id); }
    if (default_unit !== undefined) { sets.push(`default_unit = $${i++}`); params.push(String(default_unit).trim() || DEFAULT_UNIT); }
    if (description !== undefined) { sets.push(`description = $${i++}`); params.push(description); }
    if (sets.length === 0) {
      const curr = await query('SELECT id, name, code, category_id, default_unit, description FROM products WHERE id = $1', [id]);
      if (curr.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
      return res.json(curr.rows[0]);
    }
    const result = await query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, name, code, category_id, default_unit, description, created_at, updated_at`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'קוד מוצר כבר קיים' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
