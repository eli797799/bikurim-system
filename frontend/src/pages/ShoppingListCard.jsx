import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import UnitSelector from '../components/UnitSelector';

const STATUS_LABELS = { draft: 'טיוטה', approved: 'מאושרת', completed: 'בוצעה' };

function formatDateDDMMYYYY(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

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
  const [warehouses, setWarehouses] = useState([]);
  const [completeModal, setCompleteModal] = useState(false);
  const [completeWarehouseId, setCompleteWarehouseId] = useState('');
  const [emailModal, setEmailModal] = useState(false);
  const [emailSupplierId, setEmailSupplierId] = useState('');
  const [emailDraft, setEmailDraft] = useState(null);
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);

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
    api.warehouses.list({ is_active: 'true' }).then(setWarehouses).catch(() => []);
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

  const location = useLocation();
  useEffect(() => {
    if (location.state?.openEmailModal && list && items.some((i) => i.selected_supplier_id)) {
      setEmailModal(true);
      const sups = items.filter((i) => i.selected_supplier_id).reduce((acc, i) => {
        if (!acc.find((s) => s.id === i.selected_supplier_id)) acc.push({ id: i.selected_supplier_id, name: i.supplier_name, email: i.supplier_email });
        return acc;
      }, []);
      setEmailSupplierId(sups.length === 1 ? String(sups[0].id) : '');
      setEmailDraft(null);
    }
  }, [location.state?.openEmailModal, list?.id, items.length]);

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

  const changeStatus = (newStatus, warehouseId) => {
    const body = { status: newStatus };
    if (warehouseId !== undefined && warehouseId !== '') body.warehouse_id = Number(warehouseId);
    api.shoppingLists.update(id, body)
      .then((data) => {
        setList(data);
        setCompleteModal(false);
        setCompleteWarehouseId('');
        load();
      })
      .catch((e) => alert(e.message));
  };

  const updateWarehouse = (warehouseId) => {
    const val = warehouseId === '' ? null : Number(warehouseId);
    api.shoppingLists.update(id, { warehouse_id: val })
      .then((data) => {
        setList(data);
        load();
      })
      .catch((e) => alert(e.message));
  };

  const suppliersInOrder = items
    .filter((i) => i.selected_supplier_id)
    .reduce((acc, i) => {
      if (!acc.find((s) => s.id === i.selected_supplier_id)) {
        acc.push({
          id: i.selected_supplier_id,
          name: i.supplier_name || 'ספק',
          email: i.supplier_email || '',
        });
      }
      return acc;
    }, []);

  const openEmailModal = () => {
    setEmailModal(true);
    setEmailSupplierId(suppliersInOrder.length === 1 ? String(suppliersInOrder[0].id) : '');
    setEmailDraft(null);
  };

  const fetchDraftEmail = () => {
    if (!emailSupplierId) return alert('נא לבחור ספק');
    setEmailDraftLoading(true);
    api.shoppingLists.draftEmail(id, { supplier_id: Number(emailSupplierId) })
      .then((draft) => setEmailDraft(draft))
      .catch((e) => alert(e.message))
      .finally(() => setEmailDraftLoading(false));
  };

  const openMailto = () => {
    if (!emailDraft?.to) return alert('חסר כתובת מייל לספק');
    const subject = encodeURIComponent(emailDraft.subject || '');
    const body = encodeURIComponent((emailDraft.body || '').replace(/\n/g, '%0D%0A'));
    window.location.href = `mailto:${emailDraft.to}?subject=${subject}&body=${body}`;
  };

  const markEmailSent = () => {
    api.shoppingLists.update(id, { email_sent_at: new Date().toISOString() })
      .then((data) => {
        setList(data);
        setEmailModal(false);
        setEmailDraft(null);
        load();
      })
      .catch((e) => alert(e.message));
  };

  const getMessageTextForCopy = () => {
    const dateStr = formatDateDDMMYYYY(list?.list_date);
    const lines = [
      `פקודת רכש מס' ${list?.order_number ?? ''}`,
      `תאריך: ${dateStr}`,
      list?.name ? `שם: ${list.name}` : '',
      '',
      'רשימת מוצרים:',
      ...(items || []).map((i) => `- ${i.product_name || 'מוצר'}: ${Number(i.quantity)} ${i.unit_of_measure || "יח'"}`),
    ].filter(Boolean);
    return lines.join('\n');
  };

  const copyMessageToClipboard = () => {
    const text = getMessageTextForCopy();
    navigator.clipboard.writeText(text).then(() => alert('הטקסט הועתק ללוח – ניתן להדביק בווטסאפ')).catch(() => alert('ההעתקה נכשלה'));
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
          <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 600 }}>טופס הזמנת רכש (Purchase Order)</p>
          <div className="order-meta">
            <strong>פקודת רכש #{list.order_number}</strong> · {list.name} · תאריך: {list.list_date}
            {list.warehouse_name && <span> · מחסן: {list.warehouse_name}</span>}
            {list.email_sent_at && <span className="badge badge-success" style={{ marginRight: 6 }}>נשלח במייל</span>}
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
        <p>
          <strong>מחסן יעד (המשלוח אמור להגיע לכאן):</strong>{' '}
          {(canEdit || list.status === 'completed') && warehouses.length > 0 ? (
            <select
              value={list.warehouse_id ?? ''}
              onChange={(e) => updateWarehouse(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            >
              <option value="">ללא מחסן</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          ) : (
            list.warehouse_name || '—'
          )}
        </p>
        {canEdit && (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {list.status === 'draft' && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => changeStatus('approved')}>שינוי סטטוס למאושרת</button>
                <button type="button" className="btn btn-secondary" onClick={() => api.shoppingLists.duplicate(id).then((n) => navigate(`/shopping-lists/${n.id}`)).catch((e) => alert(e.message))}>שכפול פקודה</button>
              </>
            )}
            {list.status === 'approved' && (
              <button type="button" className="btn btn-primary" onClick={() => setCompleteModal(true)}>סימון כבוצעה (הכל הוזמן)</button>
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
            הפק טופס הזמנה (הדפסה)
          </button>
          {suppliersInOrder.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={openEmailModal}>
              שלח לספק
            </button>
          )}
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

      {completeModal && (
        <div className="modal-overlay" onClick={() => setCompleteModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>סימון פקודה כבוצעה</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>הפקודה תיסומן כבוצעה (הכל הוזמן). ניתן לבחור לאיזה מחסן הוזמנה ההזמנה.</p>
            <div className="form-group">
              <label>מחסן (אופציונלי)</label>
              <select
                value={completeWarehouseId}
                onChange={(e) => setCompleteWarehouseId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              >
                <option value="">ללא מחסן</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => changeStatus('completed', completeWarehouseId)}>אישור – סימון כבוצעה</button>
              <button type="button" className="btn btn-secondary" onClick={() => setCompleteModal(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {emailModal && (
        <div className="modal-overlay" onClick={() => setEmailModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 1rem' }}>שליחת הזמנה לספק</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>בחר ספק, נסח מייל (AI) ופתח בתוכנת המייל. סימון "נשלח במייל" מונע שליחה כפולה.</p>
            <div className="form-group">
              <label>שלח לספק</label>
              <select
                value={emailSupplierId}
                onChange={(e) => { setEmailSupplierId(e.target.value); setEmailDraft(null); }}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              >
                <option value="">בחר ספק...</option>
                {suppliersInOrder.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} {s.email ? `(${s.email})` : ''}</option>
                ))}
              </select>
            </div>
            {!emailDraft ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-primary" onClick={fetchDraftEmail} disabled={!emailSupplierId || emailDraftLoading}>
                  {emailDraftLoading ? 'מנסח...' : 'נסח מייל (AI)'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={copyMessageToClipboard}>
                  העתק טקסט להודעה
                </button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>אל (מייל הספק)</label>
                  <input type="text" value={emailDraft.to || ''} readOnly style={{ width: '100%', padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                </div>
                <div className="form-group">
                  <label>נושא</label>
                  <input type="text" value={emailDraft.subject || ''} readOnly style={{ width: '100%', padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                </div>
                <div className="form-group">
                  <label>גוף ההודעה</label>
                  <textarea value={emailDraft.body || ''} readOnly rows={8} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-primary" onClick={openMailto}>פתח במייל</button>
                  <button type="button" className="btn btn-secondary" onClick={copyMessageToClipboard}>העתק טקסט להודעה</button>
                  <button type="button" className="btn btn-secondary" onClick={markEmailSent}>סומן כנשלח</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEmailDraft(null)}>נסח מחדש</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEmailModal(false)}>ביטול</button>
                </div>
              </>
            )}
          </div>
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
