import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function WarehouseLinks() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.warehouses.list({ is_active: 'true' })
      .then(setList)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }, []);

  const getWorkerLink = (warehouseId) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/warehouse/${warehouseId}`;
  };

  const copyLink = (warehouseId) => {
    const url = getWorkerLink(warehouseId);
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(warehouseId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => alert('לא ניתן להעתיק. העתק ידנית: ' + url));
  };

  return (
    <>
      <h1 className="page-title">קישורים למחסנאים</h1>
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link to="/warehouses">← חזרה למחסנים</Link>
      </div>
      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          כל מחסן מקבל קישור אישי. שלח את הקישור למחסנאי – הוא ייפתח ישירות למסך המלאי של המחסן שלו, ללא ניווט במערכת.
        </p>
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : list.length === 0 ? (
          <p className="empty-state">אין מחסנים פעילים.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>מחסן</th>
                  <th>מחסנאי אחראי</th>
                  <th>קישור למחסנאי</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td data-label="מחסן"><strong>{w.name}</strong>{w.code && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>({w.code})</span>}</td>
                    <td data-label="מחסנאי">{w.responsible_user_name || '—'}</td>
                    <td data-label="קישור">
                      <code style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{getWorkerLink(w.id)}</code>
                    </td>
                    <td data-label="">
                      <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }} onClick={() => copyLink(w.id)}>
                        {copiedId === w.id ? 'הועתק!' : 'העתק קישור'}
                      </button>
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
