import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import UnitSelector, { UNIT_OPTIONS } from '../components/UnitSelector';

export default function SupplierCard() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [addProduct, setAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ product_id: '', price_per_unit: '', unit_of_measure: UNIT_OPTIONS[0], internal_code: '', min_order_quantity: '' });

  useEffect(() => {
    api.suppliers.get(id)
      .then((data) => {
        setSupplier(data);
        setProducts(data.products || []);
        setForm({
          name: data.name, tax_id: data.tax_id || '', contact_person: data.contact_person || '',
          phone: data.phone || '', email: data.email || '', address: data.address || '',
          payment_terms: data.payment_terms || '', notes: data.notes || '', status: data.status,
        });
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
    api.categories.list().then(setCategories).catch(() => {});
  }, [id]);

  const save = (e) => {
    e.preventDefault();
    api.suppliers.update(id, form)
      .then((data) => {
        setSupplier(data);
        setEdit(false);
      })
      .catch((e) => alert(e.message));
  };

  const addProductSubmit = (e) => {
    e.preventDefault();
    if (!newProduct.product_id || newProduct.price_per_unit === '') return alert('נא לבחור מוצר ולהזין מחיר');
    api.suppliers.addProduct(id, {
      product_id: newProduct.product_id,
      price_per_unit: Number(newProduct.price_per_unit),
      unit_of_measure: newProduct.unit_of_measure || UNIT_OPTIONS[0],
      internal_code: newProduct.internal_code || undefined,
      min_order_quantity: newProduct.min_order_quantity ? Number(newProduct.min_order_quantity) : undefined,
    })
      .then(() => {
        setAddProduct(false);
        setNewProduct({ product_id: '', price_per_unit: '', unit_of_measure: UNIT_OPTIONS[0], internal_code: '', min_order_quantity: '' });
        return api.suppliers.get(id);
      })
      .then((data) => {
        setSupplier(data);
        setProducts(data.products || []);
      })
      .catch((e) => alert(e.message));
  };

  const removeProduct = (productId) => {
    if (!confirm('להסיר מוצר זה מהספק?')) return;
    api.suppliers.removeProduct(id, productId)
      .then(() => api.suppliers.get(id))
      .then((data) => {
        setSupplier(data);
        setProducts(data.products || []);
      })
      .catch((e) => alert(e.message));
  };

  if (loading || !supplier) return <p className="empty-state">טוען...</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem' }}><Link to="/suppliers">← חזרה לספקים</Link></div>
      <h1 className="page-title">כרטיס ספק: {supplier.name}</h1>
      <div className="card">
        {!edit ? (
          <>
            <p><strong>ח.פ:</strong> {supplier.tax_id || '—'}</p>
            <p><strong>איש קשר:</strong> {supplier.contact_person || '—'}</p>
            <p><strong>טלפון:</strong> {supplier.phone || '—'}</p>
            <p><strong>אימייל:</strong> {supplier.email || '—'}</p>
            <p><strong>כתובת:</strong> {supplier.address || '—'}</p>
            <p><strong>תנאי תשלום:</strong> {supplier.payment_terms || '—'}</p>
            <p><strong>הערות:</strong> {supplier.notes || '—'}</p>
            <p><strong>סטטוס:</strong> <span className={`badge badge-${supplier.status === 'active' ? 'success' : 'secondary'}`}>{supplier.status === 'active' ? 'פעיל' : 'לא פעיל'}</span></p>
            <button type="button" className="btn btn-secondary" onClick={() => setEdit(true)}>עריכה</button>
          </>
        ) : (
          <form onSubmit={save}>
            <div className="form-group">
              <label>שם ספק</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
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
            <div className="form-group">
              <label>כתובת</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>תנאי תשלום</label>
              <input value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>הערות</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="form-group">
              <label>סטטוס</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">פעיל</option>
                <option value="inactive">לא פעיל</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">שמירה</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEdit(false)} style={{ marginRight: '0.5rem' }}>ביטול</button>
          </form>
        )}
      </div>
      <h2 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>טבלת מוצרים של הספק</h2>
      <div className="card">
        <button type="button" className="btn btn-primary" onClick={() => setAddProduct(!addProduct)} style={{ marginBottom: '1rem' }}>
          {addProduct ? 'ביטול' : 'הוספת מוצר מהמאגר'}
        </button>
        {addProduct && (
          <AddProductForm
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            onSubmit={addProductSubmit}
            onCancel={() => setAddProduct(false)}
          />
        )}
        {products.length === 0 ? (
          <p className="empty-state">אין מוצרים לספק זה</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם מוצר</th>
                  <th>קוד פנימי</th>
                  <th>מחיר ליחידה</th>
                  <th>יחידה</th>
                  <th>מינימום הזמנה</th>
                  <th>עדכון מחיר</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td data-label="שם מוצר"><Link to={`/products/${p.product_id}`}>{p.product_name}</Link></td>
                    <td data-label="קוד פנימי">{p.internal_code || '—'}</td>
                    <td data-label="מחיר ליחידה">{Number(p.price_per_unit).toFixed(2)}</td>
                    <td data-label="יחידה">{p.unit_of_measure}</td>
                    <td data-label="מינימום הזמנה">{p.min_order_quantity != null ? p.min_order_quantity : '—'}</td>
                    <td data-label="עדכון מחיר">{p.last_price_update || '—'}</td>
                    <td data-label=""><button type="button" className="btn btn-danger" style={{ minHeight: 40, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => removeProduct(p.product_id)}>הסר</button></td>
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

function AddProductForm({ newProduct, setNewProduct, onSubmit, onCancel }) {
  const [productOptions, setProductOptions] = useState([]);
  useEffect(() => {
    api.products.list({}).then(setProductOptions).catch(() => {});
  }, []);
  return (
    <form onSubmit={onSubmit} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
      <div className="form-group">
        <label>מוצר מהמאגר *</label>
        <select value={newProduct.product_id} onChange={(e) => setNewProduct((f) => ({ ...f, product_id: e.target.value }))} required>
          <option value="">בחר מוצר</option>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name} {p.code ? `(${p.code})` : ''}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', maxWidth: 500 }}>
        <div className="form-group">
          <label>מחיר ליחידה *</label>
          <input type="number" step="0.01" min="0" value={newProduct.price_per_unit} onChange={(e) => setNewProduct((f) => ({ ...f, price_per_unit: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>יחידה</label>
          <UnitSelector value={newProduct.unit_of_measure} onChange={(v) => setNewProduct((f) => ({ ...f, unit_of_measure: v }))} />
        </div>
        <div className="form-group">
          <label>קוד פנימי</label>
          <input value={newProduct.internal_code} onChange={(e) => setNewProduct((f) => ({ ...f, internal_code: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>מינימום הזמנה</label>
          <input type="number" step="0.01" min="0" value={newProduct.min_order_quantity} onChange={(e) => setNewProduct((f) => ({ ...f, min_order_quantity: e.target.value }))} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary">הוסף מוצר</button>
      <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ marginRight: '0.5rem' }}>ביטול</button>
    </form>
  );
}
