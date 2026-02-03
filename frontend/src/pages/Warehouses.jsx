import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const defaultForm = { name: '', code: '', address: '', location: '', notes: '', is_active: true, responsible_user_id: '' };

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const load = () => {
    setLoading(true);
    api.warehouses.list()
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => { api.users.list().then(setUsers).catch(() => {}); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return alert('שם מחסן חובה');
    const body = { ...form, responsible_user_id: form.responsible_user_id ? Number(form.responsible_user_id) : null };
    if (editingId) {
      api.warehouses.update(editingId, body)
        .then(() => { setEditingId(null); setShowForm(false); setForm(defaultForm); load(); })
        .catch((e) => alert(e.message));
    } else {
      api.warehouses.create(body)
        .then(() => { setShowForm(false); setForm(defaultForm); load(); })
        .catch((e) => alert(e.message));
    }
  };

  const startEdit = (w) => {
    setEditingId(w.id);
    setForm({
      name: w.name,
      code: w.code || '',
      address: w.address || '',
      location: w.location || '',
      notes: w.notes || '',
      is_active: w.is_active !== false,
      responsible_user_id: w.responsible_user_id ?? '',
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(defaultForm); };

  const handleDelete = (id, name) => {
    if (!confirm(`למחוק את המחסן "${name}"?`)) return;
    api.warehouses.delete(id).then(load).catch((e) => alert(e.message));
  };

  return (
    <>
      <h1 className="page-title">מחסנים</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => { setEditingId(null); setForm(defaultForm); setShowForm(!showForm); }}>
            {showForm && !editingId ? 'ביטול' : 'מחסן חדש'}
          </button>
          <Link to="/warehouses/links" className="btn btn-secondary">קישורים למחסנאים</Link>
          <Link to="/warehouses/alerts" className="btn btn-secondary">התראות חוסר מלאי</Link>
        </div>
        {showForm && (
          <form onSubmit={submit} style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', maxWidth: 560, marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>{editingId ? 'עריכת מחסן' : 'מחסן חדש'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>שם מחסן *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="מפעל צפון / מפעל מרכז" required />
              </div>
              <div className="form-group">
                <label>קוד מחסן</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="למשל: WH-N" />
              </div>
            </div>
            <div className="form-group">
              <label>מיקום (רשות)</label>
              <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="מיקום גאוגרפי" />
            </div>
            <div className="form-group">
              <label>כתובת</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="כתובת המחסן" />
            </div>
            <div className="form-group">
              <label>מחסנאי אחראי</label>
              <select value={form.responsible_user_id} onChange={(e) => setForm((f) => ({ ...f, responsible_user_id: e.target.value }))}>
                <option value="">ללא</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>הערות</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {editingId && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="wh-active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="wh-active" style={{ marginBottom: 0 }}>פעיל</label>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary">{editingId ? 'שמירה' : 'הוספה'}</button>
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>ביטול</button>
            </div>
          </form>
        )}
      </div>
      <div className="card">
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : list.length === 0 ? (
          <p className="empty-state">אין מחסנים. הוסף מחסן ראשון.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>קוד</th>
                  <th>מיקום</th>
                  <th>מחסנאי אחראי</th>
                  <th>סטטוס</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td data-label="שם"><strong>{w.name}</strong></td>
                    <td data-label="קוד">{w.code || '—'}</td>
                    <td data-label="מיקום">{w.location || '—'}</td>
                    <td data-label="מחסנאי אחראי">{w.responsible_user_name || '—'}</td>
                    <td data-label="סטטוס">
                      <span className={`badge badge-${w.is_active !== false ? 'success' : 'secondary'}`}>
                        {w.is_active !== false ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td data-label="">
                      <Link to={`/warehouses/${w.id}`} className="btn btn-primary" style={{ marginLeft: 4, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>מלאי</Link>
                      <button type="button" className="btn btn-secondary" style={{ marginLeft: 4, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => startEdit(w)}>עריכה</button>
                      <button type="button" className="btn btn-danger" style={{ marginLeft: 4, padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => handleDelete(w.id, w.name)}>מחיקה</button>
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
