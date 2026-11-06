import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/client';

export default function NotificationBell({ to = '/notifications', light = false }) {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true;
    api.get('/notifications/unread-count').then(({ data }) => alive && setUnread(data.unread)).catch(() => {});
    return () => { alive = false; };
  }, [pathname]);
  return (
    <Link to={to} className={`relative inline-flex rounded-lg p-2 ${light ? 'text-white/80 hover:bg-white/10' : 'text-ink-soft hover:bg-paper'}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell size={20} />
      {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-saffron px-1 text-center text-[11px] font-bold leading-[18px] text-ink">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
