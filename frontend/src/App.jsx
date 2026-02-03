import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import SupplierCard from './pages/SupplierCard';
import Products from './pages/Products';
import ProductCard from './pages/ProductCard';
import ShoppingLists from './pages/ShoppingLists';
import ShoppingListCard from './pages/ShoppingListCard';
import Warehouses from './pages/Warehouses';
import WarehouseDetail from './pages/WarehouseDetail';
import WarehouseAlerts from './pages/WarehouseAlerts';
import WarehouseLinks from './pages/WarehouseLinks';
import ScanDeliveryNote from './pages/ScanDeliveryNote';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();
  const isWorkerPage = location.pathname.startsWith('/warehouse/') && !location.pathname.startsWith('/warehouses/');

  return (
    <div className="app-layout">
      {!isWorkerPage && (
      <div className="app-main-wrap">
        <aside className="sidebar">
          <div className="header-logo">
            <img src="/bikurim-logo.png" alt="ביכורים" />
            <span>ביכורים – קניין</span>
          </div>
          <nav>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              לוח ראשי
            </NavLink>
            <NavLink to="/suppliers" className={({ isActive }) => (isActive ? 'active' : '')}>
              ספקים
            </NavLink>
            <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')}>
              מוצרים
            </NavLink>
            <NavLink to="/warehouses" className={({ isActive }) => (isActive ? 'active' : '')}>
              מחסנים
            </NavLink>
            <NavLink to="/shopping-lists" className={({ isActive }) => (isActive ? 'active' : '')}>
              פקודות רכש
            </NavLink>
            <NavLink to="/scan-delivery-note" className={({ isActive }) => (isActive ? 'active' : '')}>
              סריקת תעודה
            </NavLink>
          </nav>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suppliers/:id" element={<SupplierCard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductCard />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/warehouses/alerts" element={<WarehouseAlerts />} />
            <Route path="/warehouses/links" element={<WarehouseLinks />} />
            <Route path="/warehouses/:id" element={<WarehouseDetail />} />
            <Route path="/warehouse/:id" element={<WarehouseDetail />} />
            <Route path="/shopping-lists" element={<ShoppingLists />} />
            <Route path="/shopping-lists/:id" element={<ShoppingListCard />} />
            <Route path="/scan-delivery-note" element={<ScanDeliveryNote />} />
          </Routes>
        </main>
      </div>
      )}
      {isWorkerPage && (
        <main className="main main--worker-full">
          <Routes>
            <Route path="/warehouse/:id" element={<WarehouseDetail />} />
          </Routes>
        </main>
      )}
      {!isWorkerPage && (
      <footer className="app-footer">
        נבנה ע&quot;י אלי לבין
      </footer>
      )}
    </div>
  );
}

export default App;
