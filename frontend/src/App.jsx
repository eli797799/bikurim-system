import { Routes, Route, NavLink } from 'react-router-dom';
import Suppliers from './pages/Suppliers';
import SupplierCard from './pages/SupplierCard';
import Products from './pages/Products';
import ProductCard from './pages/ProductCard';
import ShoppingLists from './pages/ShoppingLists';
import ShoppingListCard from './pages/ShoppingListCard';

function App() {
  return (
    <div className="app-layout">
      <div className="app-main-wrap">
        <aside className="sidebar">
          <div className="header-logo">
            <img src="/bikurim-logo.png" alt="ביכורים" />
            <span>ביכורים – קניין</span>
          </div>
          <nav>
            <NavLink to="/suppliers" className={({ isActive }) => (isActive ? 'active' : '')}>
              ספקים
            </NavLink>
            <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')}>
              מוצרים
            </NavLink>
            <NavLink to="/shopping-lists" className={({ isActive }) => (isActive ? 'active' : '')}>
              פקודות רכש
            </NavLink>
          </nav>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Suppliers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suppliers/:id" element={<SupplierCard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductCard />} />
            <Route path="/shopping-lists" element={<ShoppingLists />} />
            <Route path="/shopping-lists/:id" element={<ShoppingListCard />} />
          </Routes>
        </main>
      </div>
      <footer className="app-footer">
        נבנה ע&quot;י אלי לבין
      </footer>
    </div>
  );
}

export default App;
