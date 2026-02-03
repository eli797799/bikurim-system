import { Router } from 'express';
import { query } from '../config/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const RATE_LIMIT_MESSAGE = 'המערכת בעומס קל, אנא המתן 30 שניות ונסה שוב';
const RETRY_DELAY_MS = 2000;

function isRateLimitError(err) {
  const msg = (err?.message || err?.toString || '').toString();
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('Too Many Requests')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** מחזיר תאריך בפורמט DD/MM/YYYY (ללא GMT / timezone) */
function formatDateDDMMYYYY(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

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

const listFields = 'id, order_number, name, list_date, notes, status, warehouse_id, email_sent_at, created_by, created_at, updated_at';

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sl.id, sl.order_number, sl.name, sl.list_date, sl.notes, sl.status, sl.warehouse_id, sl.email_sent_at, sl.created_by, sl.created_at, sl.updated_at,
              w.name AS warehouse_name
       FROM shopping_lists sl
       LEFT JOIN warehouses w ON w.id = sl.warehouse_id
       ORDER BY sl.list_date DESC, sl.order_number DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await query(
      `SELECT sl.id, sl.order_number, sl.name, sl.list_date, sl.notes, sl.status, sl.warehouse_id, sl.email_sent_at, sl.created_by, sl.created_at, sl.updated_at,
              w.name AS warehouse_name
       FROM shopping_lists sl
       LEFT JOIN warehouses w ON w.id = sl.warehouse_id
       WHERE sl.id = $1`,
      [id]
    );
    if (list.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const items = await query(
      `SELECT sli.id, sli.shopping_list_id, sli.product_id, sli.quantity, sli.unit_of_measure,
              sli.selected_supplier_id, sli.price_at_selection, sli.sort_order,
              p.name AS product_name, p.code AS product_code,
              s.name AS supplier_name, s.email AS supplier_email
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

/** טיוטת מייל לספק (Gemini) – מפתח ראשי, ב־429 המתנה 2 שניות ומפתח גיבוי */
router.post('/:id/draft-email', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supplier_id } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'נדרש supplier_id' });
    const listRes = await query(
      `SELECT sl.id, sl.order_number, sl.name, sl.list_date FROM shopping_lists sl WHERE sl.id = $1`,
      [id]
    );
    if (listRes.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const list = listRes.rows[0];
    const supplierRes = await query(
      'SELECT id, name, email FROM suppliers WHERE id = $1',
      [supplier_id]
    );
    if (supplierRes.rows.length === 0) return res.status(404).json({ error: 'ספק לא נמצא' });
    const supplier = supplierRes.rows[0];
    const itemsRes = await query(
      `SELECT sli.product_id, sli.quantity, sli.unit_of_measure, p.name AS product_name
       FROM shopping_list_items sli
       JOIN products p ON p.id = sli.product_id
       WHERE sli.shopping_list_id = $1 AND sli.selected_supplier_id = $2 ORDER BY sli.sort_order, sli.id`,
      [id, supplier_id]
    );
    const items = itemsRes.rows;
    if (items.length === 0) return res.status(400).json({ error: 'אין פריטים בפקודה עבור ספק זה' });
    const dateStr = formatDateDDMMYYYY(list.list_date);
    const itemsText = items.map((i) => `- ${i.product_name}: ${Number(i.quantity)} ${i.unit_of_measure}`).join('\n');
    const prompt = `נסח מייל מקצועי ומכובד בעברית לספק (לא ללקוח).
הנתונים:
- שם הספק: ${supplier.name}
- פקודת רכש מס': ${list.order_number}
- שם הפקודה: ${list.name}
- תאריך: ${dateStr}
- רשימת מוצרים וכמויות:
${itemsText}

החזר JSON בלבד, בלי markdown. הצג תאריכים בפורמט DD/MM/YYYY בלבד, בלי GMT או timezone.
{ "subject": "נושא המייל (משפט קצר)", "body": "גוף המייל בעברית, פסקה או שתיים, כולל פנייה לספק ורשימת המוצרים/כמויות" }`;

    const primaryKey = process.env.GOOGLE_API_KEY;
    const backupKey = process.env.GOOGLE_API_KEY_BACKUP;
    if (!primaryKey && !backupKey) return res.status(503).json({ error: 'שירות ניסוח המייל לא מוגדר. הגדר GOOGLE_API_KEY או GOOGLE_API_KEY_BACKUP.' });

    let result;
    let lastErr;
    if (primaryKey) {
      try {
        const genAI = new GoogleGenerativeAI(primaryKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        result = await model.generateContent(prompt);
      } catch (err) {
        lastErr = err;
        if (!isRateLimitError(err)) throw err;
      }
    }
    if (!result && backupKey && lastErr && isRateLimitError(lastErr)) {
      await sleep(RETRY_DELAY_MS);
      try {
        const genAI = new GoogleGenerativeAI(backupKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        result = await model.generateContent(prompt);
        lastErr = null;
      } catch (err) {
        lastErr = err;
        if (!isRateLimitError(err)) throw err;
      }
    }
    if (!result && lastErr) {
      if (isRateLimitError(lastErr)) return res.status(503).json({ error: RATE_LIMIT_MESSAGE });
      throw lastErr;
    }
    const raw = result.response?.text?.()?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let subject = `פקודת רכש מס' ${list.order_number} – ביכורים`;
    let body = `שלום ${supplier.name},\n\nמצורפת פקודת רכש מס' ${list.order_number} (${dateStr}).\n\nרשימת מוצרים:\n${itemsText}\n\nבברכה,\nביכורים תעשיות מזון בע"מ`;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) body = parsed.body;
      } catch (_) {}
    }
    res.json({ to: supplier.email || '', subject, body });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, list_date, notes, warehouse_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'שם הפקודה חובה' });
    const date = list_date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `INSERT INTO shopping_lists (name, list_date, notes, status, warehouse_id)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING id, order_number, name, list_date, notes, status, warehouse_id, created_by, created_at, updated_at`,
      [name.trim(), date, notes || null, warehouse_id || null]
    );
    const row = result.rows[0];
    const wh = row.warehouse_id ? await query('SELECT name FROM warehouses WHERE id = $1', [row.warehouse_id]) : { rows: [] };
    res.status(201).json({ ...row, warehouse_name: wh.rows[0]?.name || null });
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
      `INSERT INTO shopping_lists (name, list_date, notes, status, warehouse_id)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING id, order_number, name, list_date, notes, status, warehouse_id, created_by, created_at, updated_at`,
      [newName, newDate, orig.rows[0].notes || null, orig.rows[0].warehouse_id || null]
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
    const { name, list_date, notes, status, warehouse_id, email_sent_at } = req.body;
    const current = await query('SELECT id, status FROM shopping_lists WHERE id = $1', [id]);
    if (current.rows.length === 0) throw Object.assign(new Error('פקודת רכש לא נמצאה'), { statusCode: 404 });
    const isCompleted = current.rows[0].status === 'completed';
    if (isCompleted) {
      const allowedWhenCompleted = ['warehouse_id', 'email_sent_at'];
      const disallowed = [name !== undefined && 'name', list_date !== undefined && 'list_date', notes !== undefined && 'notes', status !== undefined && 'status'].filter(Boolean);
      if (disallowed.length > 0) throw Object.assign(new Error('פקודה שבוצעה ניתנת רק לעדכון מחסן או סימון נשלח במייל'), { statusCode: 403 });
    } else {
      if (name !== undefined || list_date !== undefined || notes !== undefined || status !== undefined || warehouse_id !== undefined) {
        await assertNotCompleted(id);
      }
    }
    const sets = [];
    const params = [id];
    let i = 2;
    if (!isCompleted) {
      if (name !== undefined) { sets.push(`name = $${i++}`); params.push(name); }
      if (list_date !== undefined) { sets.push(`list_date = $${i++}`); params.push(list_date); }
      if (notes !== undefined) { sets.push(`notes = $${i++}`); params.push(notes); }
      if (status !== undefined) {
        if (!['draft', 'approved', 'completed'].includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });
        sets.push(`status = $${i++}`);
        params.push(status);
      }
    }
    if (warehouse_id !== undefined) { sets.push(`warehouse_id = $${i++}`); params.push(warehouse_id || null); }
    if (email_sent_at !== undefined) { sets.push(`email_sent_at = $${i++}`); params.push(email_sent_at || null); }
    if (sets.length === 0) {
      const curr = await query(
        `SELECT sl.*, w.name AS warehouse_name FROM shopping_lists sl LEFT JOIN warehouses w ON w.id = sl.warehouse_id WHERE sl.id = $1`,
        [id]
      );
      return res.json(curr.rows[0]);
    }
    const result = await query(
      `UPDATE shopping_lists SET ${sets.join(', ')} WHERE id = $1 RETURNING id, order_number, name, list_date, notes, status, warehouse_id, email_sent_at, created_by, created_at, updated_at`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'פקודת רכש לא נמצאה' });
    const row = result.rows[0];
    const wh = row.warehouse_id ? await query('SELECT name FROM warehouses WHERE id = $1', [row.warehouse_id]) : { rows: [] };
    res.json({ ...row, warehouse_name: wh.rows[0]?.name || null });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
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
