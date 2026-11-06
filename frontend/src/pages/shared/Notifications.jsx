import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../api/client';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader } from '../../components/ui';
import { relative } from '../../lib/format';

export default function Notifications() {
  const { data, loading, error, reload, setData } = useFetch('/notifications');
  const markAll = async () => { await api.patch('/notifications/read-all'); reload(); };
  const open = (n) => {
    if (!n.read) {
      api.patch(`/notifications/${n._id}/read`).catch(() => {});
      setData((d) => ({ ...d, notifications: d.notifications.map((x) => (x._id === n._id ? { ...x, read: true } : x)) }));
    }
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={data?.unread > 0 && <button className="btn-ghost btn-sm" onClick={markAll}>Mark all as read</button>} />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data?.notifications.length === 0 ? <Empty icon={Bell} title="You're all caught up" /> : (
        <ul className="panel divide-y divide-line">
          {data?.notifications.map((n) => {
            const body = (
              <div className="flex gap-3 p-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-saffron'}`} aria-label={n.read ? undefined : 'Unread'} />
                <div className="flex-1">
                  <div className={`text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</div>
                  {n.message && <div className="text-sm text-ink-muted">{n.message}</div>}
                  <div className="mt-0.5 text-xs text-ink-muted">{relative(n.createdAt)}</div>
                </div>
              </div>
            );
            return <li key={n._id}>{n.link ? <Link to={n.link} onClick={() => open(n)} className="block hover:bg-paper">{body}</Link> : <button onClick={() => open(n)} className="block w-full text-left hover:bg-paper">{body}</button>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
