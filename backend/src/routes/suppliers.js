import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    let sql = `
      SELECT id, name, tax_id, contact_person, phone, email, address,
             payment_terms, notes, status, created_at, updated_at
      FROM suppliers WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (status) {
      sql += ` AND status = $${i++}`;
      params.push(status);
    }
    if (q && q.trim()) {
      sql += ` AND (name ILIKE $${i} OR contact_person ILIKE $${i} OR email ILIKE $${i})`;
      params.push(`%${q.trim()}%`);
      i++;
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await query(
      'SELECT id, name, tax_id, contact_person, phone, email, address, payment_terms, notes, status, created_at, updated_at FROM suppliers WHERE id = $1',
      [id]
    );
    if (supplier.rows.length === 0) return res.status(404).json({ error: 'ספק לא נמצא' });
    const products = await query(
      `SELECT sp.id, sp.product_id, p.name AS product_name, p.code AS product_code,
              sp.internal_code, sp.price_per_unit, sp.unit_of_measure, sp.min_order_quantity, sp.last_price_update
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = $1 ORDER BY p.name`,
      [id]
    );
    res.json({ ...supplier.rows[0], products: products.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, tax_id, contact_person, phone, email, address, payment_terms, notes, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'שם ספק חובה' });
    const result = await query(
      `INSERT INTO suppliers (name, tax_id, contact_person, phone, email, address, payment_terms, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'active'))
       RETURNING id, name, tax_id, contact_person, phone, email, address, payment_terms, notes, status, created_at, updated_at`,
      [name.trim(), tax_id || null, contact_person || null, phone || null, email || null, address || null, payment_terms || null, notes || null, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, tax_id, contact_person, phone, email, address, payment_terms, notes, status } = req.body;
    const result = await query(
      `UPDATE suppliers SET
        name = COALESCE($2, name), tax_id = COALESCE($3, tax_id), contact_person = COALESCE($4, contact_person),
        phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address),
        payment_terms = COALESCE($8, payment_terms), notes = COALESCE($9, notes), status = COALESCE($10, status)
       WHERE id = $1
       RETURNING id, name, tax_id, contact_person, phone, email, address, payment_terms, notes, status, created_at, updated_at`,
      [id, name, tax_id, contact_person, phone, email, address, payment_terms, notes, status]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'ספק לא נמצא' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'ספק לא נמצא' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const DEFAULT_UNIT = "יח'";

router.post('/:id/products', async (req, res, next) => {
  try {
    const { id: supplier_id } = req.params;
    const { product_id, internal_code, price_per_unit, unit_of_measure, min_order_quantity } = req.body;
    if (!product_id || price_per_unit == null) return res.status(400).json({ error: 'product_id ומחיר חובה' });
    const unit = (unit_of_measure && String(unit_of_measure).trim()) ? String(unit_of_measure).trim() : DEFAULT_UNIT;
    const result = await query(
      `INSERT INTO supplier_products (supplier_id, product_id, internal_code, price_per_unit, unit_of_measure, min_order_quantity, last_price_update)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       ON CONFLICT (supplier_id, product_id) DO UPDATE SET
         internal_code = COALESCE(EXCLUDED.internal_code, supplier_products.internal_code),
         price_per_unit = EXCLUDED.price_per_unit,
         unit_of_measure = COALESCE(EXCLUDED.unit_of_measure, supplier_products.unit_of_measure),
         min_order_quantity = COALESCE(EXCLUDED.min_order_quantity, supplier_products.min_order_quantity),
         last_price_update = CURRENT_DATE
       RETURNING id, supplier_id, product_id, internal_code, price_per_unit, unit_of_measure, min_order_quantity, last_price_update`,
      [supplier_id, product_id, internal_code || null, Number(price_per_unit), unit, min_order_quantity != null ? Number(min_order_quantity) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    const { id: supplier_id, productId } = req.params;
    const result = await query('DELETE FROM supplier_products WHERE supplier_id = $1 AND product_id = $2 RETURNING id', [supplier_id, productId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא אצל ספק זה' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
