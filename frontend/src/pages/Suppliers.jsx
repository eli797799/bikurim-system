import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', tax_id: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '', status: 'active' });

  const load = () => {
    setLoading(true);
    api.suppliers.list({ q: q || undefined, status: status || undefined })
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [q, status]);

  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    api.suppliers.create(form)
      .then((data) => {
        setShowForm(false);
        setForm({ name: '', tax_id: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '', status: 'active' });
        load();
        navigate(`/suppliers/${data.id}`, { state: { fromCreate: true } });
      })
      .catch((e) => alert(e.message));
  };

  return (
    <>
      <h1 className="page-title">ספקים</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="search"
            placeholder="חיפוש (שם, אימייל, איש קשר)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 280, padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <option value="">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'ביטול' : 'ספק חדש'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={submit} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <div className="form-group">
              <label>שם ספק *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: 600 }}>
              <div className="form-group">
                <label>ח.פ</label>
                <input value={form.tax_id} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>איש קשר</label>
                <input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>טלפון</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>אימייל</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>כתובת</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>תנאי תשלום</label>
              <input value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} placeholder="שוטף / מזומן / אחר" />
            </div>
            <div className="form-group">
              <label>הערות</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary">שמירה</button>
          </form>
        )}
      </div>
      <div className="card">
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : list.length === 0 ? (
          <p className="empty-state">לא נמצאו ספקים</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>איש קשר</th>
                  <th>טלפון</th>
                  <th>אימייל</th>
                  <th>סטטוס</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td data-label="שם"><Link to={`/suppliers/${s.id}`}>{s.name}</Link></td>
                    <td data-label="איש קשר">{s.contact_person || '—'}</td>
                    <td data-label="טלפון">{s.phone || '—'}</td>
                    <td data-label="אימייל">{s.email || '—'}</td>
                    <td data-label="סטטוס"><span className={`badge badge-${s.status === 'active' ? 'success' : 'secondary'}`}>{s.status === 'active' ? 'פעיל' : 'לא פעיל'}</span></td>
                    <td data-label=""><Link to={`/suppliers/${s.id}`}>לכרטיס ספק</Link></td>
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
