const BASE = import.meta.env.VITE_API_URL || '';

function buildQueryString(params) {
  if (!params) return '';
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  );
  return Object.keys(clean).length ? '?' + new URLSearchParams(clean).toString() : '';
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  categories: {
    list: () => request('/api/categories'),
  },
  suppliers: {
    list: (params) => request('/api/suppliers' + buildQueryString(params)),
    get: (id) => request(`/api/suppliers/${id}`),
    create: (body) => request('/api/suppliers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/suppliers/${id}`, { method: 'DELETE' }),
    addProduct: (id, body) => request(`/api/suppliers/${id}/products`, { method: 'POST', body: JSON.stringify(body) }),
    removeProduct: (supplierId, productId) => request(`/api/suppliers/${supplierId}/products/${productId}`, { method: 'DELETE' }),
  },
  products: {
    list: (params) => request('/api/products' + buildQueryString(params)),
    get: (id) => request(`/api/products/${id}`),
    create: (body) => request('/api/products', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  },
  shoppingLists: {
    list: () => request('/api/shopping-lists'),
    get: (id) => request(`/api/shopping-lists/${id}`),
    getBySupplier: (id) => request(`/api/shopping-lists/${id}/by-supplier`),
    getSuppliersForProduct: (listId, productId) => request(`/api/shopping-lists/${listId}/suppliers-for-product/${productId}`),
    create: (body) => request('/api/shopping-lists', { method: 'POST', body: JSON.stringify(body) }),
    duplicate: (id) => request(`/api/shopping-lists/${id}/duplicate`, { method: 'POST' }),
    update: (id, body) => request(`/api/shopping-lists/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/shopping-lists/${id}`, { method: 'DELETE' }),
    addItem: (id, body) => request(`/api/shopping-lists/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
    updateItem: (listId, itemId, body) => request(`/api/shopping-lists/${listId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteItem: (listId, itemId) => request(`/api/shopping-lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
  },
  scanDeliveryNote: {
    analyze: (imageBase64) =>
      request('/api/scan-delivery-note', {
        method: 'POST',
        body: JSON.stringify({ image: imageBase64 }),
      }),
  },
};
