import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import UnitSelector, { UNIT_OPTIONS } from '../components/UnitSelector';

export default function Products() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', category_id: '', default_unit: UNIT_OPTIONS[0], description: '' });

  const load = () => {
    setLoading(true);
    api.products.list({ q: q || undefined, category_id: categoryId || undefined })
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(load, [q, categoryId]);

  const submit = (e) => {
    e.preventDefault();
    api.products.create({
      ...form,
      category_id: form.category_id || null,
    })
      .then(() => {
        setShowForm(false);
        setForm({ name: '', code: '', category_id: '', default_unit: UNIT_OPTIONS[0], description: '' });
        load();
      })
      .catch((e) => alert(e.message));
  };

  return (
    <>
      <h1 className="page-title">מוצרים</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="search"
            placeholder="חיפוש (שם, קוד)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280, padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'ביטול' : 'מוצר חדש'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={submit} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <div className="form-group">
              <label>שם מוצר *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: 500 }}>
              <div className="form-group">
                <label>קוד מוצר</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>קטגוריה</label>
                <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                  <option value="">ללא קטגוריה</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>יחידת מידה</label>
                <UnitSelector value={form.default_unit} onChange={(v) => setForm((f) => ({ ...f, default_unit: v }))} />
              </div>
            </div>
            <div className="form-group">
              <label>תיאור</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary">שמירה</button>
          </form>
        )}
      </div>
      <div className="card">
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : list.length === 0 ? (
          <p className="empty-state">לא נמצאו מוצרים</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>קוד</th>
                  <th>קטגוריה</th>
                  <th>יחידה</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td data-label="שם"><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                    <td data-label="קוד">{p.code || '—'}</td>
                    <td data-label="קטגוריה">{p.category_name || '—'}</td>
                    <td data-label="יחידה">{p.default_unit}</td>
                    <td data-label=""><Link to={`/products/${p.id}`}>לכרטיס מוצר</Link></td>
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
