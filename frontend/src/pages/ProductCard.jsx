import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import UnitSelector, { UNIT_OPTIONS } from '../components/UnitSelector';

export default function ProductCard() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.products.get(id)
      .then((data) => {
        setProduct(data);
        setSuppliers(data.suppliers || []);
        setForm({
          name: data.name, code: data.code || '', category_id: data.category_id || '',
          default_unit: data.default_unit || UNIT_OPTIONS[0], description: data.description || '',
        });
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
    api.categories.list().then(setCategories).catch(() => {});
  }, [id]);

  const save = (e) => {
    e.preventDefault();
    api.products.update(id, { ...form, category_id: form.category_id || null })
      .then((data) => {
        setProduct(data);
        setEdit(false);
        return api.products.get(id);
      })
      .then((data) => {
        setProduct(data);
        setSuppliers(data.suppliers || []);
      })
      .catch((e) => alert(e.message));
  };

  if (loading || !product) return <p className="empty-state">טוען...</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem' }}><Link to="/products">← חזרה למוצרים</Link></div>
      <h1 className="page-title">כרטיס מוצר: {product.name}</h1>
      <div className="card">
        {!edit ? (
          <>
            <p><strong>קוד:</strong> {product.code || '—'}</p>
            <p><strong>קטגוריה:</strong> {product.category_name || '—'}</p>
            <p><strong>יחידת מידה:</strong> {product.default_unit}</p>
            <p><strong>תיאור:</strong> {product.description || '—'}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setEdit(true)}>עריכה</button>
          </>
        ) : (
          <form onSubmit={save}>
            <div className="form-group">
              <label>שם מוצר</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>קוד</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>קטגוריה</label>
              <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                <option value="">ללא</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>יחידת מידה</label>
              <UnitSelector value={form.default_unit} onChange={(v) => setForm((f) => ({ ...f, default_unit: v }))} />
            </div>
            <div className="form-group">
              <label>תיאור</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary">שמירה</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEdit(false)} style={{ marginRight: '0.5rem' }}>ביטול</button>
          </form>
        )}
      </div>
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>ספקים שמוכרים מוצר זה</h2>
      <div className="card">
        {suppliers.length === 0 ? (
          <p className="empty-state">אין ספקים למוצר זה. הוסף מוצר זה מכרטיס ספק.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם ספק</th>
                  <th>מחיר</th>
                  <th>יחידה</th>
                  <th>מינימום הזמנה</th>
                  <th>עדכון מחיר</th>
                  <th>הזול ביותר</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td data-label="שם ספק"><Link to={`/suppliers/${s.supplier_id}`}>{s.supplier_name}</Link></td>
                    <td data-label="מחיר">{Number(s.price_per_unit).toFixed(2)}</td>
                    <td data-label="יחידה">{s.unit_of_measure}</td>
                    <td data-label="מינימום הזמנה">{s.min_order_quantity != null ? s.min_order_quantity : '—'}</td>
                    <td data-label="עדכון מחיר">{s.last_price_update || '—'}</td>
                    <td data-label="הזול ביותר">{s.is_cheapest ? <span className="badge badge-success" title="הספק הזול ביותר">⭐</span> : '—'}</td>
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
