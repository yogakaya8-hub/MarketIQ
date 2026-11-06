import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { Menu, X, LogOut, Store as StoreIcon } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { VENDOR_STATUS } from '../lib/constants';

// Sidebar layout for vendor and admin consoles. `sections` is a list of { title, items: [{to, label, icon, end}] }.
export default function ConsoleLayout({ sections, title, base }) {
  const { user, vendor, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-5" aria-label={`${title} navigation`}>
      {sections.map((s) => (
        <div key={s.title}>
          <div className="mb-1 px-3 text-xs font-semibold text-white/45">{s.title}</div>
          {s.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white text-ink' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-ink p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between">
          <Logo to={base} light />
          <button className="text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="mb-6 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="text-sm font-semibold text-white">{vendor?.storeName || user?.name}</div>
          <div className="text-xs text-white/55">{title}</div>
          {vendor && vendor.status !== 'approved' && <span className={`chip mt-2 ${VENDOR_STATUS[vendor.status]?.cls}`}>{VENDOR_STATUS[vendor.status]?.label}</span>}
        </div>
        {nav}
        <div className="mt-8 flex flex-col gap-1 border-t border-white/10 pt-4">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10"><StoreIcon size={17} /> View marketplace</Link>
          <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10"><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span className="text-sm font-semibold text-ink-muted">{title}</span>
          <div className="ml-auto"><NotificationBell to={`${base}/notifications`} /></div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          {vendor && vendor.status !== 'approved' && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your store is <strong>{VENDOR_STATUS[vendor.status]?.label.toLowerCase()}</strong>. You can set up your profile now; listing products and sending offers unlock once an administrator approves the store.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
