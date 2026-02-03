import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { UNIT_OPTIONS } from '../components/UnitSelector';

export default function ScanDeliveryNote() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [step, setStep] = useState('camera'); // camera | review
  const [cameraError, setCameraError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState(null);

  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);

  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.products.list({}).then(setProducts).catch(() => {});
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraError('לא ניתן לגשת למצלמה. בדוק הרשאות בדפדפן.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (step === 'camera') startCamera();
    return () => stopCamera();
  }, [step]);

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setCapturedImage(null);
    setScanError(null);
    startCamera();
  };

  const analyze = async () => {
    if (!capturedImage) return;
    setAnalyzing(true);
    setScanError(null);
    try {
      const data = await api.scanDeliveryNote.analyze(capturedImage);
      setSupplierName(data.supplier_name || '');
      setDate(data.date || new Date().toISOString().slice(0, 10));
      setItems(
        (data.products || []).map((p) => ({
          product_name: p.product_name || '',
          quantity: p.quantity || 1,
          unit: p.unit || "יח'",
          product_id: null,
        }))
      );
      setStep('review');
    } catch (err) {
      setScanError(err.message || 'שגיאה בניתוח התמונה');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (idx, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      alert('נא לבחור מוצר לכל פריט מהקטלוג');
      return;
    }
    setSaving(true);
    try {
      const name = `תעודת משלוח - ${supplierName || 'ספק'} - ${date}`;
      const newList = await api.shoppingLists.create({
        name,
        list_date: date,
        notes: `נוצר מסריקת תעודת משלוח. ספק: ${supplierName}`,
      });
      for (const item of validItems) {
        await api.shoppingLists.addItem(newList.id, {
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_of_measure: item.unit,
        });
      }
      navigate(`/shopping-lists/${newList.id}`);
    } catch (err) {
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const backToCamera = () => {
    setStep('camera');
    setCapturedImage(null);
    setSupplierName('');
    setDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setScanError(null);
  };

  return (
    <>
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link to="/shopping-lists">← חזרה לפקודות רכש</Link>
      </div>
      <h1 className="page-title">סריקת תעודת משלוח</h1>

      {step === 'camera' && (
        <div className="card">
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            שלח תמונה של תעודת משלוח. המערכת תחלץ אוטומטית את שם הספק, התאריך ורשימת המוצרים.
          </p>
          {cameraError && (
            <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{cameraError}</p>
          )}
          {!capturedImage ? (
            <>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 500,
                  aspectRatio: '4/3',
                  background: '#111',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  margin: '0 auto 1rem',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={capture} disabled={!!cameraError}>
                צלם תמונה
              </button>
            </>
          ) : (
            <>
              <img
                src={capturedImage}
                alt="תעודת משלוח"
                style={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  borderRadius: 'var(--radius)',
                  marginBottom: '1rem',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={retake}>
                  צלם מחדש
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={analyze}
                  disabled={analyzing}
                >
                  {analyzing ? 'מנתח...' : 'נתח תמונה'}
                </button>
              </div>
              {scanError && (
                <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{scanError}</p>
              )}
            </>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="card">
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
            בדוק וערוך את הנתונים שחולצו. בחר מוצר מהקטלוג לכל שורה לפני השמירה.
          </p>
          <div className="form-group">
            <label>שם ספק</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="שם הספק"
              style={{ maxWidth: 400 }}
            />
          </div>
          <div className="form-group">
            <label>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
          <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>מוצרים</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם המוצר (מסריקה)</th>
                  <th>בחר מהקטלוג *</th>
                  <th>כמות</th>
                  <th>יחידה</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td data-label="שם מסריקה">{item.product_name}</td>
                    <td data-label="בחר מוצר">
                      <select
                        value={item.product_id || ''}
                        onChange={(e) =>
                          updateItem(idx, 'product_id', e.target.value ? Number(e.target.value) : null)
                        }
                        style={{ minWidth: 180 }}
                      >
                        <option value="">בחר מוצר</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.code ? `(${p.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="כמות">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td data-label="יחידה">
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        style={{ minWidth: 90 }}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => removeItem(idx)}
                      >
                        הסר
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={backToCamera}>
              חזור לסריקה
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving || items.filter((i) => i.product_id).length === 0}
            >
              {saving ? 'שומר...' : 'אישור ושמירה לפקודת רכש'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
