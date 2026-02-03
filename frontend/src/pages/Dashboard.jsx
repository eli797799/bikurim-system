import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const AUTO_REFRESH_MS = 60000;
const RISK_DAYS_THRESHOLD = 7;

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [forecastDays, setForecastDays] = useState(30);
  const [kpiFilter, setKpiFilter] = useState(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState('name');
  const [warehouseFilter, setWarehouseFilter] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState({});
  const [geminiCache, setGeminiCache] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.dashboard.get({ forecast_days: forecastDays })
      .then((res) => {
        setData(res);
        setUpdatedAt(res.updated_at);
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }, [forecastDays]);

  useEffect(load, [load]);
  useEffect(() => {
    const t = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const fetchGemini = (row) => {
    const key = `${row.product_id}-${forecastDays}`;
    if (geminiCache[key]) return;
    setGeminiLoading((prev) => ({ ...prev, [key]: true }));
    api.dashboard.forecastGemini({
      product_name: row.product_name,
      total_stock: row.total_stock,
      daily_avg_usage: row.daily_avg_usage,
      days_until_shortage: row.days_until_shortage,
      estimated_shortage_date: row.estimated_shortage_date,
      has_sufficient_history: row.has_sufficient_history,
    })
      .then((res) => setGeminiCache((prev) => ({ ...prev, [key]: res })))
      .catch((e) => alert(e.message))
      .finally(() => setGeminiLoading((prev) => ({ ...prev, [key]: false })));
  };

  const createShoppingList = () => {
    api.shoppingLists.create({ name: `רשימת קנייה מהלוח – ${new Date().toISOString().slice(0, 10)}` })
      .then((list) => navigate(`/shopping-lists/${list.id}`))
      .catch((e) => alert(e.message));
  };

  const addToShoppingList = (productId) => {
    api.shoppingLists.list().then((lists) => {
      const draft = lists.find((l) => l.status === 'draft');
      if (draft) {
        api.products.get(productId).then((p) => {
          api.shoppingLists.addItem(draft.id, { product_id: productId, quantity: 1, unit_of_measure: p.default_unit || "יח'" })
            .then(() => navigate(`/shopping-lists/${draft.id}`))
            .catch((e) => alert(e.message));
        });
      } else {
        api.shoppingLists.create({ name: `רשימת קנייה – ${new Date().toISOString().slice(0, 10)}` })
          .then((list) => {
            api.products.get(productId).then((p) => {
              api.shoppingLists.addItem(list.id, { product_id: productId, quantity: 1, unit_of_measure: p.default_unit || "יח'" })
                .then(() => navigate(`/shopping-lists/${list.id}`))
                .catch((e) => alert(e.message));
            });
          })
          .catch((e) => alert(e.message));
      }
    }).catch((e) => alert(e.message));
  };

  if (loading && !data) return <p className="empty-state">טוען לוח...</p>;

  const kpis = data?.kpis || { active_warehouses: 0, products_zero_stock: 0, products_below_min: 0, products_at_risk: 0 };
  const warehouses = data?.warehouses || [];
  const inventory = data?.inventory || [];
  const alerts = data?.alerts || [];
  const forecast = data?.forecast || [];

  let filteredInventory = inventory
    .filter((row) => {
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase();
        if (!(row.product_name || '').toLowerCase().includes(q) && !(row.product_code || '').toLowerCase().includes(q)) return false;
      }
      if (warehouseFilter && row.warehouses[warehouseFilter] == null) return false;
      if (kpiFilter === 'zero' && row.status !== 'חוסר') return false;
      if (kpiFilter === 'below_min' && row.status !== 'נמוך') return false;
      if (kpiFilter === 'at_risk') {
        const f = forecast.find((x) => x.product_id === row.product_id);
        if (!f || f.days_until_shortage == null || f.days_until_shortage > RISK_DAYS_THRESHOLD) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (inventorySort === 'name') return (a.product_name || '').localeCompare(b.product_name || '', 'he');
      if (inventorySort === 'total') return a.total - b.total;
      return 0;
    });

  const riskColor = (risk) => (risk === 'גבוה' ? 'danger' : risk === 'בינוני' ? 'warning' : 'success');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>לוח ראשי</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            עודכן: {updatedAt ? new Date(updatedAt).toLocaleTimeString('he-IL') : '—'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'מרענן...' : 'רענון'}
          </button>
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>סיכום עליון (KPIs)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          <button type="button" className="kpi-card" onClick={() => setKpiFilter(kpiFilter === 'warehouses' ? null : 'warehouses')} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>{kpis.active_warehouses}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>מחסנים פעילים</div>
          </button>
          <button type="button" className="kpi-card" onClick={() => setKpiFilter(kpiFilter === 'zero' ? null : 'zero')} style={{ background: kpis.products_zero_stock > 0 ? '#fee2e2' : 'var(--surface)', border: `1px solid ${kpis.products_zero_stock > 0 ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpis.products_zero_stock > 0 ? 'var(--danger)' : 'var(--text)' }}>{kpis.products_zero_stock}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>חוסר מלאי</div>
          </button>
          <button type="button" className="kpi-card" onClick={() => setKpiFilter(kpiFilter === 'below_min' ? null : 'below_min')} style={{ background: kpis.products_below_min > 0 ? '#fef9c3' : 'var(--surface)', border: `1px solid ${kpis.products_below_min > 0 ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpis.products_below_min > 0 ? '#854d0e' : 'var(--text)' }}>{kpis.products_below_min}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>מתחת למינימום</div>
          </button>
          <button type="button" className="kpi-card" onClick={() => setKpiFilter(kpiFilter === 'at_risk' ? null : 'at_risk')} style={{ background: kpis.products_at_risk > 0 ? '#fee2e2' : 'var(--surface)', border: `1px solid ${kpis.products_at_risk > 0 ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpis.products_at_risk > 0 ? 'var(--danger)' : 'var(--text)' }}>{kpis.products_at_risk}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>בסיכון (תחזית)</div>
          </button>
        </div>
        {kpiFilter && <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>הטבלאות למטה מסוננות. לחץ שוב על הכרטיס לביטול.</p>}
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>מלאי כללי – כל המחסנים</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input type="search" placeholder="חיפוש מוצר" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minWidth: 180 }} />
          <select value={warehouseFilter ?? ''} onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : null)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <option value="">כל המחסנים</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <option value="name">מיון לפי שם</option>
            <option value="total">מיון לפי כמות</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>מוצר</th>
                {warehouses.map((w) => <th key={w.id}>{w.name}</th>)}
                <th>סה"כ</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr><td colSpan={warehouses.length + 3} style={{ textAlign: 'center', padding: '1.5rem' }}>אין נתונים להצגה</td></tr>
              ) : (
                filteredInventory.map((row) => (
                  <tr key={row.product_id}>
                    <td data-label="מוצר">
                      <Link to={`/products/${row.product_id}`}>{row.product_name}</Link>
                      {row.product_code && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>({row.product_code})</span>}
                    </td>
                    {warehouses.map((w) => <td key={w.id} data-label={w.name}>{row.warehouses[w.id] != null ? Number(row.warehouses[w.id]) : '—'}</td>)}
                    <td data-label="סה״כ"><strong>{row.total}</strong></td>
                    <td data-label="סטטוס">
                      <span className={`badge badge-${row.status === 'חוסר' ? 'danger' : row.status === 'נמוך' ? 'warning' : 'success'}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>חוסרים והתראות</h2>
        {alerts.length === 0 ? (
          <p className="empty-state">אין התראות כרגע.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>מחסן</th>
                    <th>כמות נוכחית</th>
                    <th>סיבת ההתראה</th>
                    <th style={{ width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a, idx) => (
                    <tr key={`${a.warehouse_id}-${a.product_id}-${idx}`}>
                      <td data-label="מוצר"><Link to={`/products/${a.product_id}`}>{a.product_name}</Link></td>
                      <td data-label="מחסן">{a.warehouse_name}</td>
                      <td data-label="כמות">{Number(a.quantity)} {a.unit_of_measure}</td>
                      <td data-label="סיבה">{a.reason === 'חוסר' ? 'חוסר' : a.reason === 'מינימום' ? 'מתחת למינימום' : a.reason}</td>
                      <td data-label="">
                        <button type="button" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }} onClick={createShoppingList}>צור רשימת קנייה</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>תחזית מוצרים</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          חישוב לפי תנועות יציאה ב־{forecastDays} הימים האחרונים. ימים עד חוסר = מלאי ÷ שימוש יומי ממוצע.
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ marginLeft: 8 }}>תקופת חישוב: </label>
          <select value={forecastDays} onChange={(e) => setForecastDays(Number(e.target.value))} style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <option value={30}>30 יום</option>
            <option value={60}>60 יום</option>
            <option value={90}>90 יום</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>מוצר</th>
                <th>מלאי נוכחי</th>
                <th>שימוש יומי ממוצע</th>
                <th>ימים עד חוסר</th>
                <th>תאריך משוער לחוסר</th>
                <th>ניתוח Gemini</th>
                <th>רמת סיכון</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {forecast.filter((f) => f.total_stock > 0 || (f.daily_avg_usage && f.daily_avg_usage > 0)).length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>אין נתוני תחזית (נדרשת היסטוריית יציאות).</td></tr>
              ) : (
                forecast
                  .filter((f) => f.total_stock > 0 || (f.daily_avg_usage && f.daily_avg_usage > 0))
                  .map((row) => {
                    const key = `${row.product_id}-${forecastDays}`;
                    const gemini = geminiCache[key];
                    const loadingGemini = geminiLoading[key];
                    const daysRisk = row.days_until_shortage != null && row.days_until_shortage <= RISK_DAYS_THRESHOLD;
                    return (
                      <tr key={row.product_id}>
                        <td data-label="מוצר"><Link to={`/products/${row.product_id}`}>{row.product_name}</Link></td>
                        <td data-label="מלאי">{row.total_stock}</td>
                        <td data-label="שימוש יומי">{row.has_sufficient_history ? Number(row.daily_avg_usage).toFixed(2) : '—'}</td>
                        <td data-label="ימים עד חוסר">{row.days_until_shortage != null ? row.days_until_shortage.toFixed(1) : (row.has_sufficient_history ? '—' : 'אין היסטוריה')}</td>
                        <td data-label="תאריך משוער">{row.estimated_shortage_date || '—'}</td>
                        <td data-label="ניתוח Gemini">
                          {gemini ? <span style={{ fontSize: '0.85rem' }}>{gemini.explanation}</span> : loadingGemini ? <span style={{ color: 'var(--text-muted)' }}>מנתח...</span> : <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }} onClick={() => fetchGemini(row)}>הצג ניתוח מלא</button>}
                        </td>
                        <td data-label="סיכון">
                          {gemini ? <span className={`badge badge-${riskColor(gemini.risk)}`}>{gemini.risk}</span> : daysRisk ? <span className="badge badge-warning">בסיכון</span> : '—'}
                        </td>
                        <td data-label="">
                          <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }} onClick={() => addToShoppingList(row.product_id)}>הוסף לרשימת קנייה</button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
