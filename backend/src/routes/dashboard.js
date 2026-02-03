import { Router } from 'express';
import { query } from '../config/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const RATE_LIMIT_MESSAGE = 'המערכת בעומס קל, אנא המתן 30 שניות ונסה שוב';

function isRateLimitError(err) {
  const msg = (err?.message || err?.toString || '').toString();
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate limit') || msg.includes('Too Many Requests');
}
const RISK_DAYS_THRESHOLD = 7;

async function getKpis() {
  const [wh, zero, belowMin] = await Promise.all([
    query("SELECT COUNT(*) AS c FROM warehouses WHERE is_active = true"),
    query("SELECT COUNT(DISTINCT product_id) AS c FROM warehouse_inventory WHERE quantity <= 0"),
    query("SELECT COUNT(*) AS c FROM warehouse_inventory WHERE min_quantity IS NOT NULL AND quantity <= min_quantity"),
  ]);
  return {
    active_warehouses: Number(wh.rows[0]?.c ?? 0),
    products_zero_stock: Number(zero.rows[0]?.c ?? 0),
    products_below_min: Number(belowMin.rows[0]?.c ?? 0),
    products_at_risk: 0,
  };
}

async function getInventoryMatrix() {
  const warehouses = await query("SELECT id, name FROM warehouses WHERE is_active = true ORDER BY name");
  const inv = await query(
    `SELECT wi.product_id, wi.warehouse_id, wi.quantity, wi.min_quantity, p.name AS product_name, p.code AS product_code
     FROM warehouse_inventory wi
     JOIN products p ON p.id = wi.product_id
     ORDER BY p.name`
  );
  const byProduct = {};
  for (const row of inv.rows) {
    const pid = row.product_id;
    if (!byProduct[pid]) byProduct[pid] = { product_id: pid, product_name: row.product_name, product_code: row.product_code, warehouses: {}, total: 0, status: 'תקין' };
    byProduct[pid].warehouses[row.warehouse_id] = Number(row.quantity);
    byProduct[pid].total += Number(row.quantity);
    if (Number(row.quantity) <= 0) byProduct[pid].status = 'חוסר';
    else if (row.min_quantity != null && Number(row.quantity) <= Number(row.min_quantity)) byProduct[pid].status = byProduct[pid].status !== 'חוסר' ? 'נמוך' : byProduct[pid].status;
  }
  const list = Object.values(byProduct).map((r) => ({
    ...r,
    warehouse_names: warehouses.rows,
  }));
  return { warehouses: warehouses.rows, inventory: list };
}

async function getAlerts() {
  const r = await query(
    `SELECT wi.warehouse_id, w.name AS warehouse_name, wi.product_id, p.name AS product_name, wi.quantity, wi.min_quantity, wi.unit_of_measure,
            CASE WHEN wi.quantity <= 0 THEN 'חוסר' WHEN wi.min_quantity IS NOT NULL AND wi.quantity <= wi.min_quantity THEN 'מינימום' ELSE 'תחזית' END AS reason
     FROM warehouse_inventory wi
     JOIN warehouses w ON w.id = wi.warehouse_id AND w.is_active = true
     JOIN products p ON p.id = wi.product_id
     WHERE wi.quantity <= 0 OR (wi.min_quantity IS NOT NULL AND wi.quantity <= wi.min_quantity)
     ORDER BY wi.quantity ASC, w.name, p.name`
  );
  return r.rows;
}

async function getForecast(days = 30) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - Number(days) || 30);
  const fromStr = fromDate.toISOString().slice(0, 10);

  const usage = await query(
    `SELECT product_id, SUM(quantity) AS total_out
     FROM inventory_movements
     WHERE movement_type = 'out' AND movement_date >= $1
     GROUP BY product_id`,
    [fromStr]
  );
  const stock = await query(
    `SELECT product_id, SUM(quantity) AS total FROM warehouse_inventory GROUP BY product_id`
  );
  const products = await query('SELECT id, name, code FROM products ORDER BY name');
  const usageMap = Object.fromEntries(usage.rows.map((r) => [r.product_id, Number(r.total_out)]));
  const stockMap = Object.fromEntries(stock.rows.map((r) => [r.product_id, Number(r.total)]));
  const numDays = Number(days) || 30;

  const list = products.rows.map((p) => {
    const totalStock = stockMap[p.id] ?? 0;
    const totalOut = usageMap[p.id] ?? 0;
    const dailyUsage = totalOut / numDays;
    let days_until_shortage = null;
    let estimated_shortage_date = null;
    let has_sufficient_history = totalOut > 0;
    if (dailyUsage > 0) {
      days_until_shortage = totalStock / dailyUsage;
      const d = new Date();
      d.setDate(d.getDate() + Math.floor(days_until_shortage));
      estimated_shortage_date = d.toISOString().slice(0, 10);
    }
    return {
      product_id: p.id,
      product_name: p.name,
      product_code: p.code,
      total_stock: totalStock,
      daily_avg_usage: dailyUsage,
      days_until_shortage: days_until_shortage != null ? Math.round(days_until_shortage * 10) / 10 : null,
      estimated_shortage_date,
      has_sufficient_history: totalOut > 0,
    };
  });
  return { days: numDays, forecast: list };
}

router.get('/', async (req, res, next) => {
  try {
    const forecastDays = req.query.forecast_days || 30;
    const [kpis, matrix, alerts, forecast] = await Promise.all([
      getKpis().catch(() => ({ active_warehouses: 0, products_zero_stock: 0, products_below_min: 0, products_at_risk: 0 })),
      getInventoryMatrix().catch(() => ({ warehouses: [], inventory: [] })),
      getAlerts().catch(() => []),
      getForecast(forecastDays).catch(() => ({ days: 30, forecast: [] })),
    ]);
    const atRiskCount = forecast.forecast.filter(
      (f) => f.days_until_shortage != null && f.days_until_shortage <= RISK_DAYS_THRESHOLD
    ).length;
    kpis.products_at_risk = atRiskCount;
    res.json({
      kpis,
      inventory: matrix.inventory,
      warehouses: matrix.warehouses,
      alerts,
      forecast: forecast.forecast,
      forecast_days: forecast.days,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/kpis', async (req, res, next) => {
  try {
    const kpis = await getKpis();
    res.json({ ...kpis, updated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const matrix = await getInventoryMatrix();
    res.json(matrix);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.get('/forecast', async (req, res, next) => {
  try {
    const forecast = await getForecast(req.query.days || 30);
    res.json({ ...forecast, updated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

const FORECAST_PROMPT = `אתה יועץ מלאי. קיבלת נתונים על מוצר. החזר JSON בלבד, בלי markdown:
{
  "risk": "נמוך" | "בינוני" | "גבוה",
  "trend": "עולה" | "יורד" | "יציב",
  "explanation": "הסבר קצר בעברית (משפט אחד)",
  "recommendation": "המלצה לקניין (משפט אחד)"
}
אם אין היסטוריה מספקת – risk: "בינוני", trend: "יציב", explanation: "אין היסטוריה מספקת לחיזוי".`;

router.post('/forecast/gemini', async (req, res, next) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY_BACKUP;
    if (!apiKey) return res.status(503).json({ error: 'שירות הניתוח לא מוגדר.' });
    const { product_name, total_stock, daily_avg_usage, days_until_shortage, estimated_shortage_date, has_sufficient_history } = req.body;
    const text = `מוצר: ${product_name || 'לא ידוע'}
מלאי נוכחי (סה"כ): ${total_stock ?? 0}
שימוש יומי ממוצע: ${daily_avg_usage ?? 0}
ימים עד חוסר (חישוב): ${days_until_shortage ?? '—'}
תאריך משוער לחוסר: ${estimated_shortage_date ?? '—'}
היסטוריה מספקת: ${has_sufficient_history ? 'כן' : 'לא'}

${FORECAST_PROMPT}`;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(text);
    const raw = result.response?.text?.()?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { risk: 'בינוני', trend: 'יציב', explanation: 'לא ניתן לנתח.', recommendation: '' };
    res.json({
      risk: parsed.risk || 'בינוני',
      trend: parsed.trend || 'יציב',
      explanation: parsed.explanation || '',
      recommendation: parsed.recommendation || '',
    });
  } catch (err) {
    if (err instanceof SyntaxError) return res.status(502).json({ error: 'לא ניתן לפרש את התשובה.' });
    if (isRateLimitError(err)) return res.status(503).json({ error: RATE_LIMIT_MESSAGE });
    next(err);
  }
});

export default router;
