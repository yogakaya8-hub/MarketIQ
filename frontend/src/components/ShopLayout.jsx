import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth, homeFor } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { APP_NAME } from '../lib/constants';

const navCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-paper text-ink' : 'text-ink-soft hover:text-ink'}`;

export default function ShopLayout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setOpen(false);
  };
  const isCustomer = user?.role === 'customer';
  const links = [
    { to: '/products', label: 'Shop' },
    { to: '/deals', label: 'Rescue deals' },
    { to: '/requirements/new', label: 'Post a requirement' },
    ...(isCustomer ? [{ to: '/requirements', label: 'My requirements', end: true }, { to: '/orders', label: 'Orders' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <form onSubmit={submit} className="relative ml-2 hidden flex-1 md:block md:max-w-md" role="search">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input className="input pl-9" placeholder="Search products, brands, categories" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            {user && <NotificationBell />}
            {isCustomer && (
              <Link to="/cart" className="relative rounded-lg p-2 text-ink-soft hover:bg-paper" aria-label={`Cart, ${count} items`}>
                <ShoppingCart size={20} />
                {count > 0 && <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-market px-1 text-center text-[11px] font-bold leading-[18px] text-white">{count}</span>}
              </Link>
            )}
            {user && user.role !== 'customer' && (
              <Link to={homeFor(user.role)} className="btn-ink btn-sm hidden sm:inline-flex"><LayoutDashboard size={15} /> {user.role === 'admin' ? 'Admin console' : 'Vendor console'}</Link>
            )}
            {user ? (
              <div className="hidden items-center gap-1 md:flex">
                <Link to="/account" className="rounded-lg px-2 py-2 text-sm font-semibold text-ink-soft hover:text-ink">{user.name.split(' ')[0]}</Link>
                <button onClick={() => { logout(); navigate('/'); }} className="rounded-lg p-2 text-ink-muted hover:bg-paper" aria-label="Sign out"><LogOut size={18} /></button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className="btn-ghost btn-sm">Sign in</Link>
                <Link to="/register" className="btn-primary btn-sm">Create account</Link>
              </div>
            )}
            <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>{open ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 px-4 pb-2 md:flex" aria-label="Main">
          {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>)}
        </nav>
        {open && (
          <div className="border-t border-line px-4 py-3 md:hidden">
            <form onSubmit={submit} className="relative mb-3" role="search">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input className="input pl-9" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
            <nav className="flex flex-col" onClick={() => setOpen(false)}>
              {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>)}
              {user ? (
                <>
                  {user.role !== 'customer' && <NavLink to={homeFor(user.role)} className={navCls}>Console</NavLink>}
                  <NavLink to="/account" className={navCls}>Account</NavLink>
                  <button className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-soft" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navCls}>Sign in</NavLink>
                  <NavLink to="/register" className={navCls}>Create account</NavLink>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8"><Outlet /></main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between">
          <span>{APP_NAME}: a multi-vendor marketplace with smart marketplace intelligence.</span>
          <div className="flex gap-4">
            <Link to="/stores" className="hover:text-ink">Stores</Link>
            <Link to="/register?role=vendor" className="hover:text-ink">Sell on {APP_NAME}</Link>
            {user && user.role !== 'admin' && <Link to="/reports" className="hover:text-ink">Report an issue</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
}
