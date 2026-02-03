import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();
const DEFAULT_UNIT = "יח'";

function getCheapestSupplierForProduct(productId) {
  return query(
    `SELECT sp.supplier_id, sp.price_per_unit, sp.unit_of_measure, s.name AS supplier_name
     FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id AND s.status = 'active'
     WHERE sp.product_id = $1
     ORDER BY sp.price_per_unit ASC
     LIMIT 1`,
    [productId]
  ).then((r) => (r.rows.length ? r.rows[0] : null));
}

function getAllSuppliersForProduct(productId) {
  return query(
    `SELECT sp.supplier_id, sp.price_per_unit, sp.unit_of_measure, s.name AS supplier_name,
            (sp.price_per_unit = (SELECT MIN(price_per_unit) FROM supplier_products sp2
              JOIN suppliers s2 ON s2.id = sp2.supplier_id AND s2.status = 'active'
              WHERE sp2.product_id = $1)) AS is_cheapest
     FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id AND s.status = 'active'
     WHERE sp.product_id = $1
     ORDER BY sp.price_per_unit ASC`,
    [productId]
  ).then((r) => r.rows);
}

async function assertNotCompleted(shoppingListId) {
  const r = await query('SELECT status FROM shopping_lists WHERE id = $1', [shoppingListId]);
  if (r.rows.length === 0) throw Object.assign(new Error('פקודת רכש לא נמצאה'), { statusCode: 404 });
  if (r.rows[0].status === 'completed') throw Object.assign(new Error('פקודה שבוצעה אינה ניתנת לעריכה'), { statusCode: 403 });
  return r.rows[0];
}

const listFields = 'id, order_number, name, list_date, notes, status, created_by, created_at, updated_at';

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ${listFields} FROM shopping_lists ORDER BY list_date DESC, order_number DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await query(`SELECT ${listFields} FROM shopping_lists WHERE id = $1`, [id]);
    if (list.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const items = await query(
      `SELECT sli.id, sli.shopping_list_id, sli.product_id, sli.quantity, sli.unit_of_measure,
              sli.selected_supplier_id, sli.price_at_selection, sli.sort_order,
              p.name AS product_name, p.code AS product_code,
              s.name AS supplier_name
       FROM shopping_list_items sli
       JOIN products p ON p.id = sli.product_id
       LEFT JOIN suppliers s ON s.id = sli.selected_supplier_id
       WHERE sli.shopping_list_id = $1 ORDER BY sli.sort_order, sli.id`,
      [id]
    );
    const productIds = [...new Set(items.rows.map((i) => i.product_id))];
    const supplierCounts = {};
    for (const pid of productIds) {
      const suppliers = await getAllSuppliersForProduct(pid);
      supplierCounts[pid] = suppliers.length;
    }
    const itemsWithSupplierCount = items.rows.map((i) => ({ ...i, supplier_count: supplierCounts[i.product_id] || 0 }));
    res.json({ ...list.rows[0], items: itemsWithSupplierCount });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, list_date, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'שם הפקודה חובה' });
    const date = list_date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `INSERT INTO shopping_lists (name, list_date, notes, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING ${listFields}`,
      [name.trim(), date, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const orig = await query(`SELECT * FROM shopping_lists WHERE id = $1`, [id]);
    if (orig.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const items = await query(
      'SELECT product_id, quantity, unit_of_measure, selected_supplier_id, price_at_selection FROM shopping_list_items WHERE shopping_list_id = $1 ORDER BY sort_order, id',
      [id]
    );
    const newName = (orig.rows[0].name || 'פקודה').trim() + ' (עותק)';
    const newDate = new Date().toISOString().slice(0, 10);
    const newList = await query(
      `INSERT INTO shopping_lists (name, list_date, notes, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING ${listFields}`,
      [newName, newDate, orig.rows[0].notes || null]
    );
    const newId = newList.rows[0].id;
    for (let i = 0; i < items.rows.length; i++) {
      const it = items.rows[i];
      await query(
        `INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity, unit_of_measure, selected_supplier_id, price_at_selection, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newId, it.product_id, it.quantity, it.unit_of_measure, it.selected_supplier_id, it.price_at_selection, i]
      );
    }
    const full = await query(`SELECT ${listFields} FROM shopping_lists WHERE id = $1`, [newId]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, list_date, notes, status } = req.body;
    await assertNotCompleted(id);
    const sets = [];
    const params = [id];
    let i = 2;
    if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name); }
    if (list_date !== undefined) { sets.push(`list_date = $${i++}`); params.push(list_date); }
    if (notes !== undefined) { sets.push(`notes = $${i++}`); params.push(notes); }
    if (status !== undefined) {
      if (!['draft', 'approved', 'completed'].includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });
      sets.push(`status = $${i++}`);
      params.push(status);
    }
    if (sets.length === 0) {
      const curr = await query(`SELECT ${listFields} FROM shopping_lists WHERE id = $1`, [id]);
      return res.json(curr.rows[0]);
    }
    const result = await query(
      `UPDATE shopping_lists SET ${sets.join(', ')} WHERE id = $1 RETURNING ${listFields}`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await assertNotCompleted(id);
    const result = await query('DELETE FROM shopping_lists WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/suppliers-for-product/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const suppliers = await getAllSuppliersForProduct(productId);
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/items', async (req, res, next) => {
  try {
    const { id: shopping_list_id } = req.params;
    await assertNotCompleted(shopping_list_id);
    const { product_id, quantity, unit_of_measure } = req.body;
    if (!product_id || quantity == null) return res.status(400).json({ error: 'מוצר וכמות חובה' });
    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'כמות חייבת להיות חיובית' });

    const product = await query('SELECT id, name, default_unit FROM products WHERE id = $1', [product_id]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'מוצר לא נמצא' });
    const unit = (unit_of_measure && String(unit_of_measure).trim()) ? String(unit_of_measure).trim() : (product.rows[0].default_unit || DEFAULT_UNIT);

    const cheapest = await getCheapestSupplierForProduct(product_id);
    const selected_supplier_id = cheapest ? cheapest.supplier_id : null;
    const price_at_selection = cheapest ? Number(cheapest.price_per_unit) : null;

    const maxSort = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM shopping_list_items WHERE shopping_list_id = $1',
      [shopping_list_id]
    );
    const sort_order = maxSort.rows[0].next_sort;

    const result = await query(
      `INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity, unit_of_measure, selected_supplier_id, price_at_selection, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, shopping_list_id, product_id, quantity, unit_of_measure, selected_supplier_id, price_at_selection, sort_order`,
      [shopping_list_id, product_id, qty, unit, selected_supplier_id, price_at_selection, sort_order]
    );
    const row = result.rows[0];
    const supplierName = cheapest ? cheapest.supplier_name : null;
    const suppliers = await getAllSuppliersForProduct(product_id);
    res.status(201).json({
      ...row,
      product_name: product.rows[0].name,
      supplier_name: supplierName,
      supplier_count: suppliers.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT sli.id, sli.product_id, sli.quantity, sli.unit_of_measure, sli.selected_supplier_id, sli.price_at_selection, sli.sort_order,
              p.name AS product_name, p.code AS product_code,
              s.name AS supplier_name
       FROM shopping_list_items sli
       JOIN products p ON p.id = sli.product_id
       LEFT JOIN suppliers s ON s.id = sli.selected_supplier_id
       WHERE sli.shopping_list_id = $1 ORDER BY sli.sort_order, sli.id`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/items/:itemId', async (req, res, next) => {
  try {
    const { id: shopping_list_id, itemId } = req.params;
    const { quantity, unit_of_measure, selected_supplier_id, price_at_selection } = req.body;

    await assertNotCompleted(shopping_list_id);

    const item = await query(
      'SELECT id, product_id FROM shopping_list_items WHERE id = $1 AND shopping_list_id = $2',
      [itemId, shopping_list_id]
    );
    if (item.rows.length === 0) return res.status(404).json({ error: 'פריט לא נמצא' });

    let updates = [];
    let params = [itemId, shopping_list_id];
    let i = 3;

    if (selected_supplier_id !== undefined) {
      if (selected_supplier_id) {
        const sp = await query(
          'SELECT price_per_unit FROM supplier_products WHERE supplier_id = $1 AND product_id = $2',
          [selected_supplier_id, item.rows[0].product_id]
        );
        const newPrice = sp.rows.length ? Number(sp.rows[0].price_per_unit) : null;
        updates.push(`selected_supplier_id = $${i++}`);
        params.push(selected_supplier_id);
        updates.push(`price_at_selection = $${i++}`);
        params.push(newPrice);
      } else {
        updates.push(`selected_supplier_id = $${i++}`);
        params.push(null);
        updates.push(`price_at_selection = $${i++}`);
        params.push(null);
      }
    }
    if (quantity != null) {
      updates.push(`quantity = $${i++}`);
      params.push(Number(quantity));
    }
    if (unit_of_measure != null) {
      updates.push(`unit_of_measure = $${i++}`);
      params.push(unit_of_measure);
    }
    if (price_at_selection !== undefined && selected_supplier_id === undefined) {
      updates.push(`price_at_selection = $${i++}`);
      params.push(price_at_selection != null ? Number(price_at_selection) : null);
    }

    if (updates.length === 0) {
      const current = await query(
        'SELECT sli.*, p.name AS product_name, s.name AS supplier_name FROM shopping_list_items sli JOIN products p ON p.id = sli.product_id LEFT JOIN suppliers s ON s.id = sli.selected_supplier_id WHERE sli.id = $1',
        [itemId]
      );
      return res.json(current.rows[0]);
    }
    const result = await query(
      `UPDATE shopping_list_items SET ${updates.join(', ')} WHERE id = $1 AND shopping_list_id = $2
       RETURNING id, shopping_list_id, product_id, quantity, unit_of_measure, selected_supplier_id, price_at_selection, sort_order`,
      params
    );
    const updated = result.rows[0];
    const supplierName = updated.selected_supplier_id
      ? (await query('SELECT name FROM suppliers WHERE id = $1', [updated.selected_supplier_id])).rows[0]?.name
      : null;
    const productName = (await query('SELECT name FROM products WHERE id = $1', [updated.product_id])).rows[0]?.name;
    res.json({ ...updated, product_name: productName, supplier_name: supplierName });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const { id: shopping_list_id, itemId } = req.params;
    await assertNotCompleted(shopping_list_id);
    const result = await query('DELETE FROM shopping_list_items WHERE id = $1 AND shopping_list_id = $2 RETURNING id', [itemId, shopping_list_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'פריט לא נמצא' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/by-supplier', async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await query(`SELECT id, order_number, name, list_date, status FROM shopping_lists WHERE id = $1`, [id]);
    if (list.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const items = await query(
      `SELECT sli.*, p.name AS product_name, p.code AS product_code, s.name AS supplier_name
       FROM shopping_list_items sli
       JOIN products p ON p.id = sli.product_id
       LEFT JOIN suppliers s ON s.id = sli.selected_supplier_id
       WHERE sli.shopping_list_id = $1 ORDER BY s.name NULLS LAST, sli.sort_order`,
      [id]
    );
    const bySupplier = {};
    for (const row of items.rows) {
      const key = row.selected_supplier_id ? row.supplier_name : 'ללא ספק';
      if (!bySupplier[key]) bySupplier[key] = { supplier_id: row.selected_supplier_id, supplier_name: key, items: [], total: 0 };
      bySupplier[key].items.push(row);
      bySupplier[key].total += (row.quantity * (row.price_at_selection || 0));
    }
    res.json({ ...list.rows[0], by_supplier: Object.values(bySupplier) });
  } catch (err) {
    next(err);
  }
});

export default router;
