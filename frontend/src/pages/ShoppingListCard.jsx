import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import UnitSelector from '../components/UnitSelector';

const STATUS_LABELS = { draft: 'טיוטה', approved: 'מאושרת', completed: 'בוצעה' };

export default function ShoppingListCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [bySupplier, setBySupplier] = useState(null);
  const [addItem, setAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ product_id: '', quantity: 1, unit_of_measure: '' });
  const [supplierModal, setSupplierModal] = useState(null);
  const [supplierOptions, setSupplierOptions] = useState([]);

  const load = () => {
    setLoading(true);
    api.shoppingLists.get(id)
      .then((data) => {
        setList(data);
        setItems(data.items || []);
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
    api.products.list({}).then(setProducts).catch(() => {});
  };

  useEffect(load, [id]);

  const loadBySupplier = () => {
    api.shoppingLists.getBySupplier(id)
      .then(setBySupplier)
      .catch((e) => alert(e.message));
  };

  useEffect(() => {
    if (viewMode === 'by-supplier' && id) loadBySupplier();
  }, [viewMode, id]);

  const isLocked = list?.status === 'completed';
  const canEdit = !isLocked;

  const addItemSubmit = (e) => {
    e.preventDefault();
    if (!newItem.product_id || Number(newItem.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    api.shoppingLists.addItem(id, {
      product_id: newItem.product_id,
      quantity: Number(newItem.quantity),
      unit_of_measure: newItem.unit_of_measure || undefined,
    })
      .then(() => {
        setAddItem(false);
        setNewItem({ product_id: '', quantity: 1, unit_of_measure: '' });
        load();
      })
      .catch((e) => alert(e.message));
  };

  const removeItem = (itemId) => {
    if (!confirm('להסיר פריט זה?')) return;
    api.shoppingLists.deleteItem(id, itemId).then(load).catch((e) => alert(e.message));
  };

  const changeStatus = (newStatus) => {
    api.shoppingLists.update(id, { status: newStatus })
      .then((data) => {
        setList(data);
        load();
      })
      .catch((e) => alert(e.message));
  };

  const openSupplierModal = (item) => {
    api.shoppingLists.getSuppliersForProduct(id, item.product_id)
      .then((suppliers) => {
        setSupplierOptions(suppliers);
        setSupplierModal(item);
      })
      .catch((e) => alert(e.message));
  };

  const selectSupplier = (supplierId) => {
    if (!supplierModal) return;
    const supplier = supplierOptions.find((s) => s.supplier_id === Number(supplierId));
    const isMoreExpensive = supplier && !supplier.is_cheapest && supplierOptions.some((s) => s.is_cheapest);
    if (isMoreExpensive) {
      if (!confirm('הספק הנבחר יקר יותר מהזול ביותר. להמשיך?')) return;
    }
    api.shoppingLists.updateItem(id, supplierModal.id, { selected_supplier_id: Number(supplierId) })
      .then(() => {
        setSupplierModal(null);
        load();
      })
      .catch((e) => alert(e.message));
  };

  const totalSum = items.reduce((s, i) => s + (i.quantity * (i.price_at_selection || 0)), 0);
  const totalBySupplier = {};
  items.forEach((i) => {
    const key = i.supplier_name || 'ללא ספק';
    if (!totalBySupplier[key]) totalBySupplier[key] = 0;
    totalBySupplier[key] += i.quantity * (i.price_at_selection || 0);
  });

  if (loading || !list) return <p className="empty-state">טוען...</p>;

  return (
    <>
      <div className="no-print" style={{ marginBottom: '1rem' }}><Link to="/shopping-lists">← חזרה לפקודות רכש</Link></div>
      <div className="purchase-order-header">
        <img src="/bikurim-logo.png" alt="ביכורים" />
        <div className="purchase-order-header-info" style={{ flex: 1 }}>
          <h2>ביכורים תעשיות מזון בע"מ</h2>
          <div className="order-meta">
            <strong>פקודת רכש #{list.order_number}</strong> · {list.name} · תאריך: {list.list_date}
          </div>
        </div>
      </div>
      <div className="card no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <p><strong>תאריך:</strong> {list.list_date}</p>
            <p><strong>סטטוס:</strong>{' '}
          <span className={`badge badge-${list.status === 'completed' ? 'secondary' : list.status === 'approved' ? 'success' : 'warning'}`}>
            {STATUS_LABELS[list.status] || list.status}
          </span>
        </p>
        {list.notes && <p><strong>הערות:</strong> {list.notes}</p>}
        {canEdit && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {list.status === 'draft' && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => changeStatus('approved')}>שינוי סטטוס למאושרת</button>
                <button type="button" className="btn btn-secondary" onClick={() => api.shoppingLists.duplicate(id).then((n) => navigate(`/shopping-lists/${n.id}`)).catch((e) => alert(e.message))}>שכפול פקודה</button>
              </>
            )}
            {list.status === 'approved' && (
              <button type="button" className="btn btn-primary" onClick={() => changeStatus('completed')}>סימון כבוצעה</button>
            )}
          </div>
        )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>
            רשימה כללית
          </button>
          <button type="button" className={`btn ${viewMode === 'by-supplier' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('by-supplier')}>
            קיבוץ לפי ספק
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            הדפס פקודה
          </button>
        </div>
        </div>
      </div>

      {viewMode === 'list' && (
        <>
          {canEdit && (
            <div className="card no-print">
              <button type="button" className="btn btn-primary" onClick={() => setAddItem(!addItem)} style={{ marginBottom: '1rem' }}>
                {addItem ? 'ביטול' : 'הוספת מוצר לפקודה'}
              </button>
              {addItem && (
                <form onSubmit={addItemSubmit} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', maxWidth: 600 }}>
                    <div className="form-group">
                      <label>מוצר *</label>
                      <select value={newItem.product_id} onChange={(e) => setNewItem((f) => ({ ...f, product_id: e.target.value }))} required>
                        <option value="">בחר מוצר</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>כמות *</label>
                      <input type="number" step="0.01" min="0.01" value={newItem.quantity} onChange={(e) => setNewItem((f) => ({ ...f, quantity: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>יחידה</label>
                      <UnitSelector value={newItem.unit_of_measure} onChange={(v) => setNewItem((f) => ({ ...f, unit_of_measure: v }))} placeholder="ברירת מחדל ממוצר" />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>המערכת תשבץ אוטומטית את הספק הזול ביותר למוצר שנבחר.</p>
                  <button type="submit" className="btn btn-primary">הוסף לפקודה</button>
                </form>
              )}
            </div>
          )}
          <div className="card">
            {items.length === 0 ? (
              <p className="empty-state">אין פריטים בפקודה. {canEdit && 'הוסף מוצרים.'}</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>מוצר</th>
                        <th>כמות</th>
                        <th>יחידה</th>
                        <th>ספק נבחר</th>
                        <th>מחיר ליחידה</th>
                        <th>סה״כ שורה</th>
                        {canEdit && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i) => {
                        const hasMultiple = (i.supplier_count || 0) > 1;
                        return (
                          <tr key={i.id} className={hasMultiple ? '' : ''}>
                            <td data-label="מוצר">{i.product_name}</td>
                            <td data-label="כמות">{Number(i.quantity)}</td>
                            <td data-label="יחידה">{i.unit_of_measure}</td>
                            <td data-label="ספק נבחר">
                              {hasMultiple && canEdit ? (
                                <button type="button" onClick={() => openSupplierModal(i)} className="supplier-cell-btn" title="בחירת ספק">
                                  <span style={{ color: 'var(--warning)', marginLeft: 4 }}>⚠</span>
                                  {i.supplier_name ? <Link to={`/suppliers/${i.selected_supplier_id}`} onClick={(e) => e.stopPropagation()}>{i.supplier_name}</Link> : 'בחר ספק'}
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> (יש {i.supplier_count} ספקים)</span>
                                </button>
                              ) : (
                                i.supplier_name ? <Link to={`/suppliers/${i.selected_supplier_id}`}>{i.supplier_name}</Link> : <span className="badge badge-warning">ללא ספק</span>
                              )}
                            </td>
                            <td data-label="מחיר ליחידה">{i.price_at_selection != null ? Number(i.price_at_selection).toFixed(2) : '—'}</td>
                            <td data-label="סה״כ שורה">{i.price_at_selection != null ? (i.quantity * i.price_at_selection).toFixed(2) : '—'}</td>
                            {canEdit && (
                              <td data-label="">
                                {hasMultiple && (
                                  <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: '0.4rem 0.75rem', fontSize: '0.85rem', marginLeft: 4 }} onClick={() => openSupplierModal(i)}>החלף ספק</button>
                                )}
                                <button type="button" className="btn btn-danger" style={{ minHeight: 40, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => removeItem(i.id)}>הסר</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p style={{ marginTop: '1rem', fontWeight: 600 }}>סה״כ עלות כללית: ₪{totalSum.toFixed(2)}</p>
                {Object.keys(totalBySupplier).length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
                    <strong>סה״כ לפי ספק:</strong>
                    <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                      {Object.entries(totalBySupplier).map(([name, sum]) => (
                        <li key={name}>{name}: ₪{Number(sum).toFixed(2)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {viewMode === 'by-supplier' && (
        <div className="card">
          {!bySupplier ? (
            <p className="empty-state">טוען קיבוץ לפי ספק...</p>
          ) : !bySupplier.by_supplier || bySupplier.by_supplier.length === 0 ? (
            <p className="empty-state">אין פריטים בפקודה.</p>
          ) : (
            bySupplier.by_supplier.map((group) => (
              <div key={group.supplier_name} style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>הזמנה ל{group.supplier_name}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>מוצר</th>
                        <th>כמות</th>
                        <th>יחידה</th>
                        <th>מחיר ליחידה</th>
                        <th>סה״כ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((i) => (
                        <tr key={i.id}>
                          <td data-label="מוצר">{i.product_name}</td>
                          <td data-label="כמות">{Number(i.quantity)}</td>
                          <td data-label="יחידה">{i.unit_of_measure}</td>
                          <td data-label="מחיר ליחידה">{i.price_at_selection != null ? Number(i.price_at_selection).toFixed(2) : '—'}</td>
                          <td data-label="סה״כ">{i.price_at_selection != null ? (i.quantity * i.price_at_selection).toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontWeight: 600 }}>סה״כ להזמנה מהספק: ₪{Number(group.total).toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {supplierModal && (
        <div className="modal-overlay" onClick={() => setSupplierModal(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>בחירת ספק – {supplierModal.product_name}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>בחר ספק מהרשימה. הספק הזול ביותר מסומן ב-⭐</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ספק</th>
                    <th>מחיר ליחידה</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {supplierOptions.map((s) => (
                    <tr key={s.supplier_id}>
                      <td data-label="ספק"><Link to={`/suppliers/${s.supplier_id}`} target="_blank">{s.supplier_name}</Link>{s.is_cheapest && ' ⭐'}</td>
                      <td data-label="מחיר ליחידה">{Number(s.price_per_unit).toFixed(2)}</td>
                      <td data-label="">
                        <button type="button" className="btn btn-primary" style={{ minHeight: 40, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => selectSupplier(s.supplier_id)}>
                          בחר
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSupplierModal(null)}>ביטול</button>
          </div>
        </div>
      )}

      <style>{`
        .supplier-cell-btn { background: none; border: none; cursor: pointer; padding: 0; text-align: right; font: inherit; color: inherit; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { max-width: 500px; max-height: 80vh; overflow: auto; }
      `}</style>
    </>
  );
}
