import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();
const fields = 'id, name, code, address, location, notes, is_active, responsible_user_id, created_at, updated_at';

async function getWarehouseOr404(id) {
  const r = await query(
    `SELECT w.*, u.full_name AS responsible_user_name FROM warehouses w
     LEFT JOIN users u ON u.id = w.responsible_user_id WHERE w.id = $1`,
    [id]
  );
  if (r.rows.length === 0) throw Object.assign(new Error('מחסן לא נמצא'), { statusCode: 404 });
  return r.rows[0];
}

router.get('/', async (req, res, next) => {
  try {
    const { is_active, q } = req.query;
    let sql = `SELECT w.id, w.name, w.code, w.address, w.location, w.notes, w.is_active, w.responsible_user_id, w.created_at, w.updated_at,
               u.full_name AS responsible_user_name
               FROM warehouses w LEFT JOIN users u ON u.id = w.responsible_user_id WHERE 1=1`;
    const params = [];
    let i = 1;
    if (is_active !== undefined && is_active !== '') {
      sql += ` AND w.is_active = $${i++}`;
      params.push(is_active === 'true');
    }
    if (q && q.trim()) {
      sql += ` AND (w.name ILIKE $${i} OR w.code ILIKE $${i} OR w.address ILIKE $${i} OR w.notes ILIKE $${i})`;
      params.push(`%${q.trim()}%`);
      i++;
    }
    sql += ' ORDER BY w.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT wi.warehouse_id, w.name AS warehouse_name, wi.product_id, p.name AS product_name, wi.quantity, wi.min_quantity, wi.unit_of_measure, wi.last_updated_at
       FROM warehouse_inventory wi
       JOIN warehouses w ON w.id = wi.warehouse_id AND w.is_active = true
       JOIN products p ON p.id = wi.product_id
       WHERE wi.min_quantity IS NOT NULL AND wi.quantity <= wi.min_quantity
       ORDER BY w.name, wi.quantity ASC`
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const wh = await getWarehouseOr404(req.params.id);
    res.json(wh);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, code, address, location, notes, is_active, responsible_user_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'שם מחסן חובה' });
    const result = await query(
      `INSERT INTO warehouses (name, code, address, location, notes, is_active, responsible_user_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), $7)
       RETURNING id, name, code, address, location, notes, is_active, responsible_user_id, created_at, updated_at`,
      [name.trim(), code?.trim() || null, address || null, location || null, notes || null, is_active, responsible_user_id || null]
    );
    const row = result.rows[0];
    const u = row.responsible_user_id ? await query('SELECT full_name FROM users WHERE id = $1', [row.responsible_user_id]) : { rows: [] };
    res.status(201).json({ ...row, responsible_user_name: u.rows[0]?.full_name || null });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, address, location, notes, is_active, responsible_user_id } = req.body;
    const sets = [];
    const params = [id];
    let i = 2;
    if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name); }
    if (code !== undefined) { sets.push(`code = $${i++}`); params.push(code || null); }
    if (address !== undefined) { sets.push(`address = $${i++}`); params.push(address || null); }
    if (location !== undefined) { sets.push(`location = $${i++}`); params.push(location || null); }
    if (notes !== undefined) { sets.push(`notes = $${i++}`); params.push(notes || null); }
    if (is_active !== undefined) { sets.push(`is_active = $${i++}`); params.push(is_active); }
    if (responsible_user_id !== undefined) { sets.push(`responsible_user_id = $${i++}`); params.push(responsible_user_id || null); }
    if (sets.length === 0) {
      const wh = await getWarehouseOr404(id);
      return res.json(wh);
    }
    const result = await query(
      `UPDATE warehouses SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, name, code, address, location, notes, is_active, responsible_user_id, created_at, updated_at`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'מחסן לא נמצא' });
    const row = result.rows[0];
    const u = row.responsible_user_id ? await query('SELECT full_name FROM users WHERE id = $1', [row.responsible_user_id]) : { rows: [] };
    res.json({ ...row, responsible_user_name: u.rows[0]?.full_name || null });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM warehouses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'מחסן לא נמצא' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---- מלאי לפי מחסן ----
router.get('/:id/inventory', async (req, res, next) => {
  try {
    await getWarehouseOr404(req.params.id);
    const r = await query(
      `SELECT wi.id, wi.warehouse_id, wi.product_id, wi.quantity, wi.unit_of_measure, wi.min_quantity, wi.last_updated_at,
              p.name AS product_name, p.code AS product_code,
              (wi.min_quantity IS NOT NULL AND wi.quantity <= wi.min_quantity) AS is_low_stock
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id
       WHERE wi.warehouse_id = $1
       ORDER BY p.name`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/inventory/:productId', async (req, res, next) => {
  try {
    const { id: warehouse_id, productId } = req.params;
    const { min_quantity } = req.body;
    await getWarehouseOr404(warehouse_id);
    const product = await query('SELECT id, default_unit FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const existing = await query('SELECT id, quantity, unit_of_measure FROM warehouse_inventory WHERE warehouse_id = $1 AND product_id = $2', [warehouse_id, productId]);
    let row;
    if (existing.rows.length > 0) {
      await query(
        'UPDATE warehouse_inventory SET min_quantity = COALESCE($3, min_quantity), updated_at = NOW(), last_updated_at = NOW() WHERE warehouse_id = $1 AND product_id = $2 RETURNING *',
        [warehouse_id, productId, min_quantity != null ? Number(min_quantity) : null]
      ).then((r) => { row = r.rows[0]; });
    } else {
      await query(
        `INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity, unit_of_measure, min_quantity)
         VALUES ($1, $2, 0, $3, $4) RETURNING *`,
        [warehouse_id, productId, product.rows[0].default_unit || "יח'", min_quantity != null ? Number(min_quantity) : null]
      ).then((r) => { row = r.rows[0]; });
    }
    const p = await query('SELECT name, code FROM products WHERE id = $1', [productId]);
    res.json({ ...row, product_name: p.rows[0]?.name, product_code: p.rows[0]?.code, is_low_stock: row.min_quantity != null && Number(row.quantity) <= Number(row.min_quantity) });
  } catch (err) {
    next(err);
  }
});

// ---- תנועות מלאי (כניסה/יציאה) ----
router.get('/:id/movements', async (req, res, next) => {
  try {
    await getWarehouseOr404(req.params.id);
    const r = await query(
      `SELECT m.id, m.warehouse_id, m.product_id, m.movement_type, m.quantity, m.unit_of_measure, m.movement_date, m.user_id, m.source_type, m.reference_id, m.destination, m.note, m.created_at,
              p.name AS product_name, p.code AS product_code,
              u.full_name AS user_name
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.warehouse_id = $1
       ORDER BY m.created_at DESC
       LIMIT 500`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/movements', async (req, res, next) => {
  try {
    const warehouse_id = req.params.id;
    const { movement_type, product_id, quantity, movement_date, source_type, reference_id, destination, note, user_id } = req.body;
    if (!movement_type || !['in', 'out'].includes(movement_type)) return res.status(400).json({ error: 'סוג תנועה חובה: in או out' });
    if (!product_id || quantity == null) return res.status(400).json({ error: 'מוצר וכמות חובה' });
    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'כמות חייבת להיות חיובית' });
    await getWarehouseOr404(warehouse_id);
    const product = await query('SELECT id, name, default_unit FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const unit = product.rows[0].default_unit || "יח'";
    const date = movement_date || new Date().toISOString().slice(0, 10);

    const inv = await query('SELECT id, quantity, unit_of_measure FROM warehouse_inventory WHERE warehouse_id = $1 AND product_id = $2', [warehouse_id, product_id]);
    if (movement_type === 'out') {
      const currentQty = inv.rows.length ? Number(inv.rows[0].quantity) : 0;
      if (currentQty < qty) return res.status(400).json({ error: `כמות במלאי (${currentQty}) קטנה מהמבוקשת (${qty}). לא ניתן לבצע יציאה.` });
      if (inv.rows.length === 0) return res.status(400).json({ error: 'אין מלאי למוצר זה במחסן' });
    }

    if (movement_type === 'in') {
      if (inv.rows.length === 0) {
        await query(
          `INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity, unit_of_measure, min_quantity) VALUES ($1, $2, $3, $4, NULL)`,
          [warehouse_id, product_id, qty, unit]
        );
      } else {
        await query(
          'UPDATE warehouse_inventory SET quantity = quantity + $3, last_updated_at = NOW(), updated_at = NOW() WHERE warehouse_id = $1 AND product_id = $2',
          [warehouse_id, product_id, qty]
        );
      }
    } else {
      await query(
        'UPDATE warehouse_inventory SET quantity = quantity - $3, last_updated_at = NOW(), updated_at = NOW() WHERE warehouse_id = $1 AND product_id = $2',
        [warehouse_id, product_id, qty]
      );
    }

    const mov = await query(
      `INSERT INTO inventory_movements (warehouse_id, product_id, movement_type, quantity, unit_of_measure, movement_date, user_id, source_type, reference_id, destination, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, warehouse_id, product_id, movement_type, quantity, unit_of_measure, movement_date, user_id, source_type, reference_id, destination, note, created_at`,
      [warehouse_id, product_id, movement_type, qty, unit, date, user_id || null, source_type || null, reference_id || null, destination || null, note || null]
    );
    const row = mov.rows[0];
    res.status(201).json({ ...row, product_name: product.rows[0].name });
  } catch (err) {
    next(err);
  }
});

// ---- צפי משלוחים למחסן (פקודות מאושרות שמיועדות למחסן) ----
router.get('/:id/expected-deliveries', async (req, res, next) => {
  try {
    const warehouse_id = req.params.id;
    await getWarehouseOr404(warehouse_id);
    const lists = await query(
      `SELECT sl.id, sl.order_number, sl.name, sl.list_date, sl.status
       FROM shopping_lists sl
       WHERE sl.warehouse_id = $1 AND sl.status = 'approved'
       ORDER BY sl.list_date DESC, sl.order_number DESC`,
      [warehouse_id]
    );
    const result = [];
    for (const row of lists.rows) {
      const items = await query(
        `SELECT sli.product_id, sli.quantity, sli.unit_of_measure, p.name AS product_name, p.code AS product_code
         FROM shopping_list_items sli
         JOIN products p ON p.id = sli.product_id
         WHERE sli.shopping_list_id = $1 ORDER BY sli.sort_order, sli.id`,
        [row.id]
      );
      result.push({ ...row, items: items.rows });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- קבלת משלוח מפקודת רכש (יצירת תנועות + השוואה והתראה לקניין אם יש חוסר התאמה) ----
router.post('/:id/receive-from-order', async (req, res, next) => {
  try {
    const warehouse_id = req.params.id;
    const { shopping_list_id, movement_date, items } = req.body;
    if (!shopping_list_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'נדרשים shopping_list_id ו-items (מערך פריטים עם product_id, quantity, unit_of_measure)' });
    }
    await getWarehouseOr404(warehouse_id);
    const listRes = await query(
      'SELECT id, order_number, name, warehouse_id FROM shopping_lists WHERE id = $1',
      [shopping_list_id]
    );
    if (listRes.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const list = listRes.rows[0];
    if (Number(list.warehouse_id) !== Number(warehouse_id)) {
      return res.status(400).json({ error: 'פקודת הרכש לא מיועדת למחסן זה' });
    }
    const orderItems = await query(
      `SELECT sli.product_id, sli.quantity, sli.unit_of_measure, p.name AS product_name
       FROM shopping_list_items sli JOIN products p ON p.id = sli.product_id
       WHERE sli.shopping_list_id = $1 ORDER BY sli.id`,
      [shopping_list_id]
    );
    const date = movement_date || new Date().toISOString().slice(0, 10);
    const receivedByProduct = {};
    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      if (!pid || qty <= 0) continue;
      const prod = await query('SELECT id, name, default_unit FROM products WHERE id = $1', [pid]);
      if (prod.rows.length === 0) continue;
      const unit = (it.unit_of_measure || prod.rows[0].default_unit || "יח'").trim() || "יח'";
      receivedByProduct[pid] = { quantity: qty, unit, product_name: prod.rows[0].name };
      const inv = await query(
        'SELECT id, quantity, unit_of_measure FROM warehouse_inventory WHERE warehouse_id = $1 AND product_id = $2',
        [warehouse_id, pid]
      );
      if (inv.rows.length === 0) {
        await query(
          `INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity, unit_of_measure, min_quantity) VALUES ($1, $2, $3, $4, NULL)`,
          [warehouse_id, pid, qty, unit]
        );
      } else {
        await query(
          'UPDATE warehouse_inventory SET quantity = quantity + $3, last_updated_at = NOW(), updated_at = NOW() WHERE warehouse_id = $1 AND product_id = $2',
          [warehouse_id, pid, qty]
        );
      }
      await query(
        `INSERT INTO inventory_movements (warehouse_id, product_id, movement_type, quantity, unit_of_measure, movement_date, user_id, source_type, reference_id, destination, note)
         VALUES ($1, $2, 'in', $3, $4, $5, NULL, 'supplier', $6, NULL, 'קבלה מפקודת רכש #' || $7)`,
        [warehouse_id, pid, qty, unit, date, shopping_list_id, list.order_number]
      );
    }
    const orderedByProduct = {};
    for (const o of orderItems.rows) {
      orderedByProduct[o.product_id] = { quantity: Number(o.quantity), unit: o.unit_of_measure, product_name: o.product_name };
    }
    const differences = [];
    for (const [pid, ord] of Object.entries(orderedByProduct)) {
      const rec = receivedByProduct[pid];
      const ordered_qty = ord.quantity;
      const received_qty = rec ? rec.quantity : 0;
      if (received_qty !== ordered_qty) {
        differences.push({
          product_id: Number(pid),
          product_name: ord.product_name,
          ordered_qty,
          received_qty,
          unit: ord.unit,
          type: received_qty < ordered_qty ? 'short' : 'over',
        });
      }
    }
    for (const [pid, rec] of Object.entries(receivedByProduct)) {
      if (!orderedByProduct[pid]) {
        differences.push({
          product_id: Number(pid),
          product_name: rec.product_name,
          ordered_qty: 0,
          received_qty: rec.quantity,
          unit: rec.unit,
          type: 'extra',
        });
      }
    }
    let discrepancyAlert = null;
    if (differences.length > 0) {
      const wh = await query('SELECT name FROM warehouses WHERE id = $1', [warehouse_id]);
      const ins = await query(
        `INSERT INTO receipt_discrepancy_alerts (warehouse_id, shopping_list_id, warehouse_name, order_number, list_name, details, read_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         RETURNING id, warehouse_id, shopping_list_id, warehouse_name, order_number, list_name, details, read_at, created_at`,
        [
          warehouse_id,
          shopping_list_id,
          wh.rows[0]?.name || null,
          list.order_number,
          list.name,
          JSON.stringify({ movement_date: date, differences, ordered: orderItems.rows.map((o) => ({ product_id: o.product_id, product_name: o.product_name, quantity: Number(o.quantity), unit: o.unit_of_measure })), received: items }),
        ]
      );
      discrepancyAlert = ins.rows[0];
    }
    res.status(201).json({ success: true, discrepancy_alert: discrepancyAlert });
  } catch (err) {
    next(err);
  }
});

// ---- התראות מחסן בודד ----
router.get('/:id/alerts', async (req, res, next) => {
  try {
    await getWarehouseOr404(req.params.id);
    const r = await query(
      `SELECT wi.product_id, p.name AS product_name, p.code AS product_code, wi.quantity, wi.min_quantity, wi.unit_of_measure, wi.last_updated_at
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id
       WHERE wi.warehouse_id = $1 AND wi.min_quantity IS NOT NULL AND wi.quantity <= wi.min_quantity
       ORDER BY wi.quantity ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
