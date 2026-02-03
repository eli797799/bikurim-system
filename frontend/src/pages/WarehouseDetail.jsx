import { useState, useEffect, useRef } from 'react';
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
  const [receiveSubMode, setReceiveSubMode] = useState(null);
  const [scanImage, setScanImage] = useState(null);
  const [scanAnalyzing, setScanAnalyzing] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [scanSaving, setScanSaving] = useState(false);
  const scanFileInputRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const [scanUseCamera, setScanUseCamera] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState('name');
  const [expectedDeliveries, setExpectedDeliveries] = useState([]);
  const [expectedPopupDismissed, setExpectedPopupDismissed] = useState(false);
  const [receiveFromOrderListId, setReceiveFromOrderListId] = useState(null);
  const [receiveFromOrderItems, setReceiveFromOrderItems] = useState([]);
  const [receiveFromOrderSaving, setReceiveFromOrderSaving] = useState(false);
  const [receiveFromOrderDate, setReceiveFromOrderDate] = useState(new Date().toISOString().slice(0, 10));

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
    if (isWorkerView) {
      api.warehouses.getExpectedDeliveries(id).then(setExpectedDeliveries).catch(() => setExpectedDeliveries([]));
    }
  };

  useEffect(load, [id]);
  useEffect(() => {
    if (isWorkerView && id) api.warehouses.getExpectedDeliveries(id).then(setExpectedDeliveries).catch(() => setExpectedDeliveries([]));
  }, [isWorkerView, id]);
  useEffect(() => {
    api.products.list({}).then(setProducts).catch(() => []);
    api.suppliers.list({}).then(setSuppliers).catch(() => []);
  }, []);
  useEffect(() => {
    if (!isWorkerView) return;
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [isWorkerView]);

  useEffect(() => {
    if (receiveSubMode === 'scan' && scanUseCamera) startScanCamera();
    return () => stopScanCamera();
  }, [receiveSubMode, scanUseCamera]);

  const filteredInventory = inventory
    .filter((row) => !inventorySearch.trim() || (row.product_name || '').toLowerCase().includes(inventorySearch.toLowerCase()) || (row.product_code || '').toLowerCase().includes(inventorySearch.toLowerCase()))
    .slice()
    .sort((a, b) => {
      if (inventorySort === 'name') return (a.product_name || '').localeCompare(b.product_name || '', 'he');
      if (inventorySort === 'quantity') return Number(a.quantity) - Number(b.quantity);
      return 0;
    });

  const openReceiveModal = () => {
    setReceiveSubMode(null);
    setScanImage(null);
    setScanError(null);
    setScannedData(null);
    setScannedItems([]);
    setScanUseCamera(false);
    setReceiveFromOrderListId(null);
    setReceiveFromOrderItems([]);
    setReceiveFromOrderDate(new Date().toISOString().slice(0, 10));
    setReceiveModal(true);
  };

  const startReceiveFromOrder = (list) => {
    setReceiveFromOrderListId(list.id);
    setReceiveFromOrderItems(
      (list.items || []).map((i) => ({ product_id: i.product_id, product_name: i.product_name, quantity: Number(i.quantity), unit_of_measure: i.unit_of_measure, received_qty: Number(i.quantity) }))
    );
    setReceiveSubMode('from-order');
  };

  const submitReceiveFromOrder = () => {
    const toSend = receiveFromOrderItems.filter((i) => i.received_qty != null && Number(i.received_qty) > 0);
    if (toSend.length === 0) return alert('נא להזין כמות שהתקבלה לפחות לפריט אחד');
    setReceiveFromOrderSaving(true);
    api.warehouses
      .receiveFromOrder(id, {
        shopping_list_id: receiveFromOrderListId,
        movement_date: receiveFromOrderDate,
        items: toSend.map((i) => ({ product_id: i.product_id, quantity: Number(i.received_qty), unit_of_measure: i.unit_of_measure })),
      })
      .then((res) => {
        load();
        api.warehouses.getExpectedDeliveries(id).then(setExpectedDeliveries).catch(() => {});
        setReceiveModal(false);
        setReceiveSubMode(null);
        setReceiveFromOrderListId(null);
        setReceiveFromOrderItems([]);
        if (res.discrepancy_alert) alert('המשלוח נרשם. נשלחה התראה לקניין על חוסר התאמה בכמויות/פריטים.');
      })
      .catch((e) => alert(e.message))
      .finally(() => setReceiveFromOrderSaving(false));
  };

  const updateReceiveFromOrderItem = (idx, field, value) => {
    setReceiveFromOrderItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const startScanCamera = async () => {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) scanVideoRef.current.srcObject = stream;
    } catch (err) {
      setScanError('לא ניתן לגשת למצלמה. בדוק הרשאות בדפדפן.');
    }
  };

  const stopScanCamera = () => {
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((t) => t.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
  };

  const captureFromCamera = () => {
    if (!scanVideoRef.current?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = scanVideoRef.current.videoWidth;
    canvas.height = scanVideoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(scanVideoRef.current, 0, 0);
    setScanImage(canvas.toDataURL('image/jpeg', 0.85));
    stopScanCamera();
    setScanUseCamera(false);
  };

  const handleReceive = (e) => {
    e.preventDefault();
    if (!receiveForm.product_id || !receiveForm.quantity || Number(receiveForm.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    const date = isWorkerView ? new Date().toISOString().slice(0, 10) : receiveForm.movement_date;
    api.warehouses.createMovement(id, {
      movement_type: 'in',
      product_id: Number(receiveForm.product_id),
      quantity: Number(receiveForm.quantity),
      movement_date: date,
      source_type: isWorkerView ? 'other' : receiveForm.source_type,
      reference_id: isWorkerView ? null : (receiveForm.reference_id ? Number(receiveForm.reference_id) : null),
      note: receiveForm.note || null,
    })
      .then(() => {
        setReceiveModal(false);
        setReceiveForm({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), source_type: 'supplier', reference_id: '', note: '' });
        setReceiveSubMode(null);
        load();
      })
      .catch((e) => alert(e.message));
  };

  const handleScanFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => { setScanImage(reader.result); setScanError(null); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const analyzeScan = () => {
    if (!scanImage) return;
    setScanAnalyzing(true);
    setScanError(null);
    api.scanDeliveryNote.analyze(scanImage)
      .then((data) => {
        setScannedData(data);
        setScannedItems(
          (data.products || []).map((p) => ({
            product_name: p.product_name || '',
            quantity: p.quantity ?? 1,
            unit: p.unit || "יח'",
            product_id: null,
          }))
        );
        setReceiveForm((f) => ({ ...f, movement_date: data.date || new Date().toISOString().slice(0, 10) }));
        const match = suppliers.find((s) => (data.supplier_name || '').trim() && s.name && data.supplier_name.includes(s.name));
        if (match) setReceiveForm((f) => ({ ...f, reference_id: String(match.id) }));
        setReceiveSubMode('scan-review');
      })
      .catch((e) => {
        setScanError(e.message || 'שגיאה בניתוח התמונה');
      })
      .finally(() => setScanAnalyzing(false));
  };

  const updateScannedItem = (idx, field, value) => {
    setScannedItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const receiveAllFromScan = () => {
    const toAdd = scannedItems.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (toAdd.length === 0) return alert('נא לבחור מוצר מהקטלוג לכל פריט');
    setScanSaving(true);
    const date = receiveForm.movement_date;
    const note = 'מסריקת תעודת משלוח';
    Promise.all(
      toAdd.map((item) =>
        api.warehouses.createMovement(id, {
          movement_type: 'in',
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          movement_date: date,
          source_type: 'supplier',
          reference_id: receiveForm.reference_id ? Number(receiveForm.reference_id) : null,
          note,
        })
      )
    )
      .then(() => {
        setReceiveModal(false);
        setReceiveSubMode(null);
        setScannedData(null);
        setScannedItems([]);
        setReceiveForm({ product_id: '', quantity: '', movement_date: new Date().toISOString().slice(0, 10), source_type: 'supplier', reference_id: '', note: '' });
        load();
      })
      .catch((e) => alert(e.message))
      .finally(() => setScanSaving(false));
  };

  const handleIssue = (e) => {
    e.preventDefault();
    if (!issueForm.product_id || !issueForm.quantity || Number(issueForm.quantity) <= 0) return alert('נא לבחור מוצר ולהזין כמות');
    const item = inventory.find((i) => i.product_id === Number(issueForm.product_id));
    const available = item ? Number(item.quantity) : 0;
    const qty = Number(issueForm.quantity);
    if (available < qty) return alert(`כמות במלאי (${available}) קטנה מהמבוקשת (${qty}). לא ניתן לבצע יציאה.`);
    const issueDate = isWorkerView ? new Date().toISOString().slice(0, 10) : issueForm.movement_date;
    api.warehouses.createMovement(id, {
      movement_type: 'out',
      product_id: Number(issueForm.product_id),
      quantity: qty,
      movement_date: issueDate,
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
      <div className={`card ${isWorkerView ? 'worker-header-card' : ''}`} style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{warehouse.name}</h1>
            {isWorkerView && warehouse.responsible_user_name && <p style={{ margin: '0.25rem 0 0', fontSize: '1rem' }}>מחסנאי: {warehouse.responsible_user_name}</p>}
            {isWorkerView && <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>{currentTime.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
            {!isWorkerView && warehouse.code && <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>קוד: {warehouse.code}</span>}
            {!isWorkerView && warehouse.location && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>מיקום: {warehouse.location}</p>}
            {!isWorkerView && warehouse.responsible_user_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>מחסנאי אחראי: {warehouse.responsible_user_name}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" style={isWorkerView ? { padding: '0.85rem 1.5rem', fontSize: '1.1rem', minHeight: 48 } : {}} onClick={openReceiveModal}>
              ➕ קיבלתי משלוח
            </button>
            <button type="button" className="btn btn-secondary" style={isWorkerView ? { padding: '0.85rem 1.5rem', fontSize: '1.1rem', minHeight: 48 } : {}} onClick={() => setIssueModal(true)}>
              ➖ הוצאתי סחורה
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

      {isWorkerView && expectedDeliveries.length > 0 && !expectedPopupDismissed && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--primary)', background: 'rgba(34, 139, 34, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong style={{ fontSize: '1.1rem' }}>צפי לקבל משלוח</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>יש {expectedDeliveries.length} פקוד{expectedDeliveries.length === 1 ? 'ת' : 'ות'} רכש מאושרות שמיועדות למחסן זה.</p>
              <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, fontSize: '0.95rem' }}>
                {expectedDeliveries.map((d) => (
                  <li key={d.id}>
                    <strong>פקודה #{d.order_number}</strong> – {d.name} (תאריך: {d.list_date})
                    <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                      {(d.items || []).map((it, i) => (
                        <li key={i}>{it.product_name}: {Number(it.quantity)} {it.unit_of_measure}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="btn btn-primary" style={isWorkerView ? { minHeight: 44 } : {}} onClick={() => setExpectedPopupDismissed(true)}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      {!isWorkerView && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className={`btn ${tab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('inventory')}>מלאי</button>
          <button type="button" className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('movements')}>יומן תנועות</button>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem' }}>מלאי במחסן</h3>
          {isWorkerView && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
              <input type="search" placeholder="חיפוש מוצר" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', minWidth: 160 }} />
              <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <option value="name">מיון לפי שם</option>
                <option value="quantity">מיון לפי כמות</option>
              </select>
            </div>
          )}
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
                    {isWorkerView ? <><th>מינימום (התראה)</th><th>סטטוס</th></> : <><th>כמות מינימום (התראה)</th><th>תאריך עדכון אחרון</th></>}
                  </tr>
                </thead>
                <tbody>
                  {(isWorkerView ? filteredInventory : inventory).map((row) => (
                    <tr key={row.product_id} className={row.is_low_stock ? 'low-stock-row' : ''}>
                      <td data-label="מוצר">
                        <strong>{row.product_name}</strong>
                        {!isWorkerView && row.product_code && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>({row.product_code})</span>}
                        {!isWorkerView && row.is_low_stock && <span className="badge badge-warning" style={{ marginRight: 4 }}>חוסר</span>}
                      </td>
                      <td data-label="כמות נוכחית">{Number(row.quantity)}</td>
                      <td data-label="יחידה">{row.unit_of_measure}</td>
                      {isWorkerView ? (
                        <>
                          <td data-label="מינימום">
                            {editingMin === row.product_id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                <input type="number" step="0.01" min="0" value={minQuantityVal} onChange={(e) => setMinQuantityVal(e.target.value)} style={{ width: 72, padding: '0.35rem', fontSize: isWorkerView ? '1rem' : undefined }} />
                                <button type="button" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => saveMinQuantity(row.product_id)}>שמירה</button>
                                <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => { setEditingMin(null); setMinQuantityVal(''); }}>ביטול</button>
                              </span>
                            ) : (
                              <span onClick={() => startEditMin(row)} style={{ cursor: 'pointer', textDecoration: 'underline' }} title="לחץ לעריכת מינימום – מתחת לזה תקבל התראה">
                                {row.min_quantity != null ? Number(row.min_quantity) : '—'}
                              </span>
                            )}
                          </td>
                          <td data-label="סטטוס">
                            <span className={`badge badge-${row.is_low_stock ? 'danger' : 'success'}`}>{row.is_low_stock ? 'נמוך' : 'תקין'}</span>
                          </td>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
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
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 1rem' }}>קבלת משלוח (כניסה)</h3>

            {receiveSubMode === null && (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {expectedDeliveries.length > 0 && (
                    <button type="button" className="btn btn-primary" style={{ fontSize: isWorkerView ? '1rem' : '0.9rem', minHeight: isWorkerView ? 48 : undefined }} onClick={() => setReceiveSubMode('from-order')}>
                      📦 קבל מפקודת רכש
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" style={{ fontSize: isWorkerView ? '1rem' : '0.9rem', minHeight: isWorkerView ? 48 : undefined }} onClick={() => setReceiveSubMode('scan')}>
                    📷 סרוק תעודה (משוח עם AI)
                  </button>
                </div>
                <form onSubmit={handleReceive}>
                  <div className="form-group">
                    <label>מוצר *</label>
                    <select value={receiveForm.product_id} onChange={(e) => setReceiveForm((f) => ({ ...f, product_id: e.target.value }))} required style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}}>
                      <option value="">בחר מוצר</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>כמות שהתקבלה *</label>
                    <input type="number" step="0.01" min="0.01" value={receiveForm.quantity} onChange={(e) => setReceiveForm((f) => ({ ...f, quantity: e.target.value }))} required style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} />
                  </div>
                  {!isWorkerView && (
                    <div className="form-group">
                      <label>תאריך קבלה</label>
                      <input type="date" value={receiveForm.movement_date} onChange={(e) => setReceiveForm((f) => ({ ...f, movement_date: e.target.value }))} />
                    </div>
                  )}
                  {!isWorkerView && (
                    <>
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
                    </>
                  )}
                  <div className="form-group">
                    <label>הערה {isWorkerView && '(אופציונלי)'}</label>
                    <input value={receiveForm.note} onChange={(e) => setReceiveForm((f) => ({ ...f, note: e.target.value }))} placeholder="אופציונלי" style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" style={isWorkerView ? { minHeight: 48, fontSize: '1.05rem' } : {}}>אישור</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setReceiveModal(false)} style={isWorkerView ? { minHeight: 48 } : {}}>ביטול</button>
                  </div>
                </form>
              </>
            )}

            {receiveSubMode === 'from-order' && (
              <>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>בחר פקודה והזן את הכמויות שהתקבלו. אם יש שינוי מההזמנה – הקניין יקבל התראה.</p>
                {!receiveFromOrderListId ? (
                  <div className="form-group">
                    <label>פקודת רכש</label>
                    <select value="" onChange={(e) => { const v = e.target.value; if (v) startReceiveFromOrder(expectedDeliveries.find((d) => d.id === Number(v))); }} style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}>
                      <option value="">בחר פקודה...</option>
                      {expectedDeliveries.map((d) => (
                        <option key={d.id} value={d.id}>#{d.order_number} – {d.name} ({d.list_date})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label>תאריך קבלה</label>
                      <input type="date" value={receiveFromOrderDate} onChange={(e) => setReceiveFromOrderDate(e.target.value)} style={{ padding: '0.5rem' }} />
                    </div>
                    <div className="table-wrap" style={{ marginBottom: '1rem', maxHeight: 260, overflow: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>מוצר</th>
                            <th>כמות בהזמנה</th>
                            <th>כמות שהתקבלה *</th>
                            <th>יחידה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiveFromOrderItems.map((item, idx) => (
                            <tr key={idx}>
                              <td data-label="מוצר">{item.product_name}</td>
                              <td data-label="בהזמנה">{Number(item.quantity)}</td>
                              <td data-label="התקבלה">
                                <input type="number" step="0.01" min="0" value={item.received_qty ?? ''} onChange={(e) => updateReceiveFromOrderItem(idx, 'received_qty', e.target.value)} style={{ width: 80, padding: '0.35rem' }} />
                              </td>
                              <td data-label="יחידה">{item.unit_of_measure}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" onClick={submitReceiveFromOrder} disabled={receiveFromOrderSaving}>
                        {receiveFromOrderSaving ? 'שומר...' : 'אשר קבלה'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setReceiveSubMode(null); setReceiveFromOrderListId(null); setReceiveFromOrderItems([]); }}>חזור</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setReceiveModal(false)}>ביטול</button>
                    </div>
                  </>
                )}
              </>
            )}

            {receiveSubMode === 'scan' && (
              <>
                <input ref={scanFileInputRef} type="file" accept="image/*" onChange={handleScanFileSelect} style={{ display: 'none' }} />
                {!scanImage && !scanUseCamera && (
                  <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary" style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} onClick={() => setScanUseCamera(true)}>
                      📷 צלם עכשיו
                    </button>
                    <button type="button" className="btn btn-secondary" style={isWorkerView ? { minHeight: 48 } : {}} onClick={() => scanFileInputRef.current?.click()}>
                      בחר תמונה מהמכשיר
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setReceiveSubMode(null)}>חזור להזנה ידנית</button>
                  </div>
                )}
                {scanUseCamera && !scanImage && (
                  <div style={{ marginBottom: '1rem' }}>
                    <video ref={scanVideoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 280, borderRadius: 'var(--radius)', background: '#000' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" onClick={captureFromCamera}>צלם תעודה</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { stopScanCamera(); setScanUseCamera(false); }}>ביטול</button>
                    </div>
                  </div>
                )}
                {scanImage && (
                  <>
                    <img src={scanImage} alt="תעודה" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 'var(--radius)', marginBottom: '1rem' }} />
                    <button type="button" className="btn btn-primary" onClick={analyzeScan} disabled={scanAnalyzing} aria-busy={scanAnalyzing}>
                      {scanAnalyzing ? 'המערכת בעומס קל, מנסה שוב אוטומטית...' : 'נתח תמונה'}
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ marginRight: '0.5rem' }} onClick={() => { setScanImage(null); setScanError(null); }}>תמונה אחרת</button>
                  </>
                )}
                {scanError && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{scanError}</p>}
                <div style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setReceiveModal(false); stopScanCamera(); }}>ביטול</button>
                </div>
              </>
            )}

            {receiveSubMode === 'scan-review' && (
              <>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>בחר מוצר מהקטלוג לכל שורה, ואז הוסף את כולם למלאי.</p>
                <div className="form-group">
                  <label>תאריך קבלה</label>
                  <input type="date" value={receiveForm.movement_date} onChange={(e) => setReceiveForm((f) => ({ ...f, movement_date: e.target.value }))} />
                </div>
                {scannedData?.supplier_name && (
                  <div className="form-group">
                    <label>ספק (מסריקה)</label>
                    <select value={receiveForm.reference_id} onChange={(e) => setReceiveForm((f) => ({ ...f, reference_id: e.target.value }))}>
                      <option value="">ללא</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="table-wrap" style={{ marginBottom: '1rem', maxHeight: 240, overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>שם מסריקה</th>
                        <th>בחר מוצר *</th>
                        <th>כמות</th>
                        <th>יחידה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedItems.map((item, idx) => (
                        <tr key={idx}>
                          <td data-label="שם">{item.product_name}</td>
                          <td data-label="מוצר">
                            <select value={item.product_id || ''} onChange={(e) => updateScannedItem(idx, 'product_id', e.target.value ? Number(e.target.value) : null)} style={{ minWidth: 140 }}>
                              <option value="">בחר</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td data-label="כמות">
                            <input type="number" step="0.01" min="0.01" value={item.quantity} onChange={(e) => updateScannedItem(idx, 'quantity', e.target.value)} style={{ width: 70 }} />
                          </td>
                          <td data-label="יחידה">
                            <input value={item.unit} onChange={(e) => updateScannedItem(idx, 'unit', e.target.value)} style={{ width: 60 }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={receiveAllFromScan} disabled={scanSaving || scannedItems.every((i) => !i.product_id)}>
                    {scanSaving ? 'מוסיף...' : 'קבל את כל הפריטים למלאי'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setReceiveSubMode('scan'); setScanImage(null); setScannedData(null); setScannedItems([]); }}>סרוק תמונה אחרת</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setReceiveSubMode(null)}>חזור להזנה ידנית</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setReceiveModal(false)}>ביטול</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {issueModal && (
        <div className="modal-overlay" onClick={() => setIssueModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: isWorkerView ? 380 : 420 }}>
            <h3 style={{ margin: '0 0 1rem' }}>הוצאת סחורה (יציאה)</h3>
            <form onSubmit={handleIssue}>
              <div className="form-group">
                <label>מוצר *</label>
                <select value={issueForm.product_id} onChange={(e) => setIssueForm((f) => ({ ...f, product_id: e.target.value }))} required style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}}>
                  <option value="">בחר מוצר</option>
                  {(isWorkerView ? filteredInventory : inventory).filter((i) => Number(i.quantity) > 0).map((i) => (
                    <option key={i.product_id} value={i.product_id}>{i.product_name} (במלאי: {Number(i.quantity)} {i.unit_of_measure})</option>
                  ))}
                  {inventory.filter((i) => Number(i.quantity) > 0).length === 0 && <option value="" disabled>אין מוצרים במלאי</option>}
                </select>
              </div>
              <div className="form-group">
                <label>כמות שהוצאה *</label>
                <input type="number" step="0.01" min="0.01" value={issueForm.quantity} onChange={(e) => setIssueForm((f) => ({ ...f, quantity: e.target.value }))} required style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} />
              </div>
              {!isWorkerView && (
                <div className="form-group">
                  <label>תאריך</label>
                  <input type="date" value={issueForm.movement_date} onChange={(e) => setIssueForm((f) => ({ ...f, movement_date: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label>יעד {isWorkerView && '(ייצור / אחר)'}</label>
                <input value={issueForm.destination} onChange={(e) => setIssueForm((f) => ({ ...f, destination: e.target.value }))} placeholder="אופציונלי" style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} />
              </div>
              <div className="form-group">
                <label>הערה</label>
                <input value={issueForm.note} onChange={(e) => setIssueForm((f) => ({ ...f, note: e.target.value }))} placeholder="אופציונלי" style={isWorkerView ? { minHeight: 48, fontSize: '1rem' } : {}} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={isWorkerView ? { minHeight: 48, fontSize: '1.05rem' } : {}}>אישור</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIssueModal(false)} style={isWorkerView ? { minHeight: 48 } : {}}>ביטול</button>
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
