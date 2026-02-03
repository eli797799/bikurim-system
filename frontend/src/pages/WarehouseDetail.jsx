import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api';

const SOURCE_TYPES = [{ value: 'supplier', label: 'ספק' }, { value: 'internal', label: 'העברה פנימית' }, { value: 'other', label: 'אחר' }];

export default function WarehouseDetail() {
  const { id } = useParams();
  const location = useLocation();
  const isWorkerView = location.pathname.startsWith('/warehouse/') && !location.pathname.startsWith('/warehouses/');
  const [warehouse, setWarehouse] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('inventory');
  const [receiveModal, setReceiveModal] = useState(false);
  const [issueModal, setIssueModal] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), source_type: 'supplier', reference_id: '', note: '' });
  const [issueForm, setIssueForm] = useState({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), destination: '', note: '' });
  const [editingMin, setEditingMin] = useState(null);
  const [minQuantityVal, setMinQuantityVal] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.warehouses.get(id),
      api.warehouses.getInventory(id),
      api.warehouses.getMovements(id),
      api.warehouses.getAlertsByWarehouse(id),
    ])
      .then(([wh, inv, mov, alt]) => {
        setWarehouse(wh);
        setInventory(inv);
        setMovements(mov);
        setAlerts(alt);
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  useEffect(() => {
    api.products.list({}).then(setProducts).catch(() => []);
    api.suppliers.list({}).then(setSuppliers).catch(() => []);
  }, []);

  const handleReceive = (e) => {
    e.preventDefault();
    if (!receiveForm.product_id || !receiveForm.quantity || Number(receiveForm.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    api.warehouses.createMovement(id, {
      movement_type: 'in',
      product_id: Number(receiveForm.product_id),
      quantity: Number(receiveForm.quantity),
      movement_date: receiveForm.movement_date,
      source_type: receiveForm.source_type,
      reference_id: receiveForm.reference_id ? Number(receiveForm.reference_id) : null,
      note: receiveForm.note || null,
    })
      .then(() => {
        setReceiveModal(false);
        setReceiveForm({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), source_type: 'supplier', reference_id: '', note: '' });
        load();
      })
      .catch((e) => alert(e.message));
  };

  const handleIssue = (e) => {
    e.preventDefault();
    if (!issueForm.product_id || !issueForm.quantity || Number(issueForm.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    const item = inventory.find((i) => i.product_id === Number(issueForm.product_id));
    const available = item ? Number(item.quantity) : 0;
    const qty = Number(issueForm.quantity);
    if (available < qty) return alert(`כמות במלאי (${available}) קטנה מהמבוקשת (${qty}). לא ניתן לבצע יציאה.`);
    api.warehouses.createMovement(id, {
      movement_type: 'out',
      product_id: Number(issueForm.product_id),
      quantity: qty,
      movement_date: issueForm.movement_date,
      destination: issueForm.destination || null,
      note: issueForm.note || null,
    })
      .then(() => {
        setIssueModal(false);
        setIssueForm({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), destination: '', note: '' });
        load();
      })
      .catch((e) => alert(e.message));
  };

  const saveMinQuantity = (productId) => {
    const val = minQuantityVal === '' ? null : Number(minQuantityVal);
    api.warehouses.updateInventoryMin(id, productId, { min_quantity: val })
      .then(() => { setEditingMin(null); setMinQuantityVal(''); load(); })
      .catch((e) => alert(e.message));
  };

  const startEditMin = (row) => {
    setEditingMin(row.product_id);
    setMinQuantityVal(row.min_quantity != null ? String(row.min_quantity) : '');
  };

  if (loading || !warehouse) return <p className="empty-state">טוען...</p>;

  return (
    <>
      {!isWorkerView && (
        <div className="no-print" style={{ marginBottom: '1rem' }}>
          <Link to="/warehouses">← חזרה למחסנים</Link>
        </div>
      )}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{warehouse.name}</h1>
            {warehouse.code && <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>קוד: {warehouse.code}</span>}
            {warehouse.location && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>מיקום: {warehouse.location}</p>}
            {warehouse.responsible_user_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>מחסנאי אחראי: {warehouse.responsible_user_name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" style={isWorkerView ? { padding: '0.75rem 1.25rem', fontSize: '1.05rem' } : {}} onClick={() => setReceiveModal(true)}>
              קיבלתי משלוח
            </button>
            <button type="button" className="btn btn-secondary" style={isWorkerView ? { padding: '0.75rem 1.25rem', fontSize: '1.05rem' } : {}} onClick={() => setIssueModal(true)}>
              הוצאתי סחורה
            </button>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warning)', background: 'rgba(255,193,7,0.08)' }}>
          <strong>התראת חוסר מלאי</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            {alerts.map((a) => `${a.product_name} (${Number(a.quantity)} ${a.unit_of_measure} – מינימום ${Number(a.min_quantity)})`).join(' · ')}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className={`btn ${tab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('inventory')}>מלאי</button>
        <button type="button" className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('movements')}>יומן תנועות</button>
      </div>

      {tab === 'inventory' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem' }}>מלאי במחסן</h3>
          {inventory.length === 0 ? (
            <p className="empty-state">אין עדיין מלאי במחסן. בצע "קיבלתי משלוח" כדי להוסיף.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>כמות נוכחית</th>
                    <th>יחידה</th>
                    <th>כמות מינימום (התראה)</th>
                    <th>תאריך עדכון אחרון</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => (
                    <tr key={row.product_id} className={row.is_low_stock ? 'low-stock-row' : ''}>
                      <td data-label="מוצר">
                        <strong>{row.product_name}</strong>
                        {row.product_code && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>({row.product_code})</span>}
                        {row.is_low_stock && <span className="badge badge-warning" style={{ marginRight: 4 }}>חוסר</span>}
                      </td>
                      <td data-label="כמות נוכחית">{Number(row.quantity)}</td>
                      <td data-label="יחידה">{row.unit_of_measure}</td>
                      <td data-label="כמות מינימום">
                        {editingMin === row.product_id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input type="number" step="0.01" min="0" value={minQuantityVal} onChange={(e) => setMinQuantityVal(e.target.value)} style={{ width: 80, padding: '0.25rem' }} />
                            <button type="button" className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }} onClick={() => saveMinQuantity(row.product_id)}>שמירה</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem' }} onClick={() => { setEditingMin(null); setMinQuantityVal(''); }}>ביטול</button>
                          </span>
                        ) : (
                          <span onClick={() => startEditMin(row)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                            {row.min_quantity != null ? Number(row.min_quantity) : '—'}
                          </span>
                        )}
                      </td>
                      <td data-label="תאריך עדכון">{row.last_updated_at ? new Date(row.last_updated_at).toLocaleDateString('he-IL') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem' }}>יומן תנועות מלאי</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>לא ניתן למחוק תנועות – לצפייה בלבד.</p>
          {movements.length === 0 ? (
            <p className="empty-state">אין תנועות עדיין.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>סוג</th>
                    <th>מוצר</th>
                    <th>כמות</th>
                    <th>מקור/יעד</th>
                    <th>משתמש</th>
                    <th>הערה</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td data-label="תאריך">{m.movement_date}</td>
                      <td data-label="סוג">
                        <span className={`badge badge-${m.movement_type === 'in' ? 'success' : 'secondary'}`}>
                          {m.movement_type === 'in' ? 'כניסה' : 'יציאה'}
                        </span>
                      </td>
                      <td data-label="מוצר">{m.product_name}</td>
                      <td data-label="כמות">{Number(m.quantity)} {m.unit_of_measure}</td>
                      <td data-label="מקור/יעד">{m.movement_type === 'in' ? (m.source_type || '—') : (m.destination || '—')}</td>
                      <td data-label="משתמש">{m.user_name || '—'}</td>
                      <td data-label="הערה">{m.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {receiveModal && (
        <div className="modal-overlay" onClick={() => setReceiveModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 1rem' }}>קבלת משלוח (כניסה)</h3>
            <form onSubmit={handleReceive}>
              <div className="form-group">
                <label>מוצר *</label>
                <select value={receiveForm.product_id} onChange={(e) => setReceiveForm((f) => ({ ...f, product_id: e.target.value }))} required>
                  <option value="">בחר מוצר</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>כמות שהתקבלה *</label>
                <input type="number" step="0.01" min="0.01" value={receiveForm.quantity} onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>תאריך קבלה</label>
                <input type="date" value={receiveForm.movement_date} onChange={(e) => setReceiveForm((f) => ({ ...f, movement_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>מקור</label>
                <select value={receiveForm.source_type} onChange={(e) => setReceiveForm((f) => ({ ...f, source_type: e.target.value }))}>
                  {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {receiveForm.source_type === 'supplier' && (
                <div className="form-group">
                  <label>ספק (אופציונלי)</label>
                  <select value={receiveForm.reference_id} onChange={(e) => setReceiveForm((f) => ({ ...f, reference_id: e.target.value }))}>
                    <option value="">ללא</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>הערה</label>
                <input value={receiveForm.note} onChange={(e) => setReceiveForm((f) => ({ ...f, note: e.target.value }))} placeholder="אופציונלי" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">אישור – הוספה למלאי</button>
                <button type="button" className="btn btn-secondary" onClick={() => setReceiveModal(false)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {issueModal && (
        <div className="modal-overlay" onClick={() => setIssueModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 1rem' }}>הוצאת סחורה (יציאה)</h3>
            <form onSubmit={handleIssue}>
              <div className="form-group">
                <label>מוצר *</label>
                <select value={issueForm.product_id} onChange={(e) => setIssueForm((f) => ({ ...f, product_id: e.target.value }))} required>
                  <option value="">בחר מוצר</option>
                  {inventory.filter((i) => Number(i.quantity) > 0).map((i) => (
                    <option key={i.product_id} value={i.product_id}>{i.product_name} (במלאי: {Number(i.quantity)} {i.unit_of_measure})</option>
                  ))}
                  {inventory.filter((i) => Number(i.quantity) > 0).length === 0 && <option value="" disabled>אין מוצרים במלאי</option>}
                </select>
              </div>
              <div className="form-group">
                <label>כמות שהוצאה *</label>
                <input type="number" step="0.01" min="0.01" value={issueForm.quantity} onChange={(e) => setIssueForm((f) => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>תאריך</label>
                <input type="date" value={issueForm.movement_date} onChange={(e) => setIssueForm((f) => ({ ...f, movement_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>יעד (מפעל / ייצור / אחר)</label>
                <input value={issueForm.destination} onChange={(e) => setIssueForm((f) => ({ ...f, destination: e.target.value }))} placeholder="אופציונלי" />
              </div>
              <div className="form-group">
                <label>הערה</label>
                <input value={issueForm.note} onChange={(e) => setIssueForm((f) => ({ ...f, note: e.target.value }))} placeholder="אופציונלי" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">אישור – הורדה מהמלאי</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIssueModal(false)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { max-width: 500px; max-height: 90vh; overflow: auto; }
        .low-stock-row { background: rgba(255,193,7,0.1); }
      `}</style>
    </>
  );
}
