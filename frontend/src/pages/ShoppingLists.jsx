import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import UnitSelector from '../components/UnitSelector';

const STATUS_LABELS = { draft: 'טיוטה', approved: 'מאושרת', completed: 'בוצעה' };

export default function ShoppingLists() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', list_date: new Date().toISOString().slice(0, 10), notes: '', warehouse_id: '' });
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', quantity: 1, unit_of_measure: '' });

  const load = () => {
    setLoading(true);
    api.shoppingLists.list()
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (showForm) {
      api.products.list({}).then(setProducts).catch(() => {});
      api.warehouses.list({ is_active: 'true' }).then(setWarehouses).catch(() => []);
    }
  }, [showForm]);

  const addPendingItem = (e) => {
    e.preventDefault();
    if (!newItem.product_id || Number(newItem.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    const product = products.find((p) => p.id === Number(newItem.product_id));
    setPendingItems((prev) => [
      ...prev,
      {
        product_id: Number(newItem.product_id),
        product_name: product?.name || '',
        quantity: Number(newItem.quantity),
        unit_of_measure: newItem.unit_of_measure || undefined,
      },
    ]);
    setNewItem({ product_id: '', quantity: 1, unit_of_measure: '' });
  };

  const removePendingItem = (idx) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const newList = await api.shoppingLists.create({
        ...form,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
      });
      for (const item of pendingItems) {
        await api.shoppingLists.addItem(newList.id, {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
        });
      }
      setShowForm(false);
      setForm({ name: '', list_date: new Date().toISOString().slice(0, 10), notes: '', warehouse_id: '' });
      setPendingItems([]);
      setNewItem({ product_id: '', quantity: 1, unit_of_measure: '' });
      navigate(`/shopping-lists/${newList.id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDuplicate = (e, listId) => {
    e.preventDefault();
    e.stopPropagation();
    api.shoppingLists.duplicate(listId)
      .then((newList) => navigate(`/shopping-lists/${newList.id}`))
      .catch((e) => alert(e.message));
  };

  const handleDelete = (e, row) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`למחוק את פקודת הרכש "${row.name}" (מס׳ ${row.order_number})?`)) return;
    api.shoppingLists.delete(row.id)
      .then(load)
      .catch((e) => alert(e.message));
  };

  return (
    <>
      <h1 className="page-title">פקודות רכש</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'ביטול' : 'פקודת רכש חדשה'}
          </button>
          <Link to="/scan-delivery-note" className="btn btn-secondary">
            סריקת תעודת משלוח
          </Link>
        </div>
        {showForm && (
          <form onSubmit={submit} style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', maxWidth: 700 }}>
            <div className="form-group">
              <label>שם הפקודה *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="למשל: קניית ביכורים – יום א'" required />
            </div>
            <div className="form-group">
              <label>תאריך יצירה *</label>
              <input type="date" value={form.list_date} onChange={(e) => setForm((f) => ({ ...f, list_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>הערות כלליות</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label>מחסן יעד – לאיזה מחסן המשלוח אמור להגיע</label>
              <select value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">ללא מחסן</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>מוצרים לפקודה</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>הוסף מוצרים עכשיו (או אחרי יצירת הפקודה). המערכת תשבץ אוטומטית את הספק הזול ביותר.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>מוצר</label>
                <select value={newItem.product_id} onChange={(e) => setNewItem((f) => ({ ...f, product_id: e.target.value }))}>
                  <option value="">בחר מוצר</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>כמות</label>
                <input type="number" step="0.01" min="0.01" value={newItem.quantity} onChange={(e) => setNewItem((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>יחידה</label>
                <UnitSelector value={newItem.unit_of_measure} onChange={(v) => setNewItem((f) => ({ ...f, unit_of_measure: v }))} placeholder="ברירת מחדל" />
              </div>
              <button type="button" className="btn btn-secondary" onClick={addPendingItem}>הוסף</button>
            </div>

            {pendingItems.length > 0 && (
              <div className="table-wrap" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>מוצר</th>
                      <th>כמות</th>
                      <th>יחידה</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems.map((item, idx) => (
                      <tr key={idx}>
                        <td data-label="מוצר">{item.product_name}</td>
                        <td data-label="כמות">{item.quantity}</td>
                        <td data-label="יחידה">{item.unit_of_measure || '—'}</td>
                        <td data-label=""><button type="button" className="btn btn-danger" style={{ minHeight: 40, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => removePendingItem(idx)}>הסר</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              יצירת פקודה (טיוטה){pendingItems.length > 0 ? ` עם ${pendingItems.length} מוצרים` : ''}
            </button>
          </form>
        )}
      </div>
      <div className="card">
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : list.length === 0 ? (
          <p className="empty-state">אין פקודות רכש. צור פקודה חדשה.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>מס׳ סידורי</th>
                  <th>שם הפקודה</th>
                  <th>תאריך</th>
                  <th>סטטוס</th>
                  <th>מחסן</th>
                  <th>נשלח</th>
                  <th>הערות</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td data-label="מס׳ סידורי"><strong>{row.order_number}</strong></td>
                    <td data-label="שם הפקודה"><Link to={`/shopping-lists/${row.id}`}>{row.name}</Link></td>
                    <td data-label="תאריך">{row.list_date}</td>
                    <td data-label="סטטוס">
                      <span className={`badge badge-${row.status === 'completed' ? 'secondary' : row.status === 'approved' ? 'success' : 'warning'}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td data-label="מחסן">{row.warehouse_name || '—'}</td>
                    <td data-label="נשלח">{row.email_sent_at ? <span className="badge badge-success">נשלח במייל</span> : '—'}</td>
                    <td data-label="הערות">{row.notes ? row.notes.slice(0, 40) + (row.notes.length > 40 ? '…' : '') : '—'}</td>
                    <td data-label="">
                      <Link to={`/shopping-lists/${row.id}`}>לפתיחה</Link>
                      <Link to={`/shopping-lists/${row.id}`} state={{ openEmailModal: true }} className="btn btn-primary" style={{ marginRight: 8, marginLeft: 4, padding: '0.25rem 0.5rem', fontSize: '0.85rem', display: 'inline-block' }}>שלח לספק</Link>
                      {row.status !== 'completed' && (
                        <button type="button" className="btn btn-secondary" style={{ marginRight: 8, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={(ev) => handleDuplicate(ev, row.id)}>שכפול</button>
                      )}
                      <button type="button" className="btn btn-danger" style={{ marginRight: 8, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={(ev) => handleDelete(ev, row)}>מחיקה</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
