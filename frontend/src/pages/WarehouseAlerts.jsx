import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function WarehouseAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.warehouses.getAlerts()
      .then(setAlerts)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byWarehouse = alerts.reduce((acc, a) => {
    const key = a.warehouse_id;
    if (!acc[key]) acc[key] = { warehouse_name: a.warehouse_name, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  return (
    <>
      <h1 className="page-title">התראות חוסר מלאי</h1>
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <Link to="/warehouses">← חזרה למחסנים</Link>
      </div>
      <div className="card">
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          מחסנים שיורדים מתחת לכמות המינימום (התראה לקניין).
        </p>
        {loading ? (
          <p className="empty-state">טוען...</p>
        ) : alerts.length === 0 ? (
          <p className="empty-state">אין התראות חוסר מלאי כרגע.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {Object.entries(byWarehouse).map(([whId, { warehouse_name, items }]) => (
              <div key={whId} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', background: 'rgba(255,193,7,0.06)' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>
                  <Link to={`/warehouses/${whId}`}>{warehouse_name}</Link>
                </h3>
                <ul style={{ margin: 0, paddingRight: '1.5rem' }}>
                  {items.map((a) => (
                    <li key={`${a.warehouse_id}-${a.product_id}`}>
                      <strong>{a.product_name}</strong> – כמות נוכחית: {Number(a.quantity)} {a.unit_of_measure}, מינימום: {Number(a.min_quantity)} (עודכן: {a.last_updated_at ? new Date(a.last_updated_at).toLocaleDateString('he-IL') : '—'})
                    </li>
                  ))}
                </ul>
                <Link to={`/warehouses/${whId}`} className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>למלאי המחסן</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
