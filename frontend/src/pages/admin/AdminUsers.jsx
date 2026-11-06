import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, PageHeader, Tabs, Pagination } from '../../components/ui';
import { date, relative } from '../../lib/format';

export default function AdminUsers() {
  const toast = useToast();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/admin/users', { params: { page, ...(role ? { role } : {}), ...(q ? { q } : {}) } });
  const setStatus = async (u, isActive) => {
    if (!isActive && !window.confirm(`Suspend ${u.name}? They will be signed out and unable to log in.`)) return;
    try {
      await api.patch(`/admin/users/${u._id}/status`, { isActive });
      toast(isActive ? 'Account reactivated' : 'Account suspended');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <div>
      <PageHeader title="Users" subtitle="Customers, vendors and administrators." />
      <Tabs value={role} onChange={(v) => { setRole(v); setPage(1); }} tabs={[{ value: '', label: 'Everyone' }, { value: 'customer', label: 'Customers' }, { value: 'vendor', label: 'Vendors' }, { value: 'admin', label: 'Admins' }]} />
      <input className="input mb-4 max-w-sm" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="table min-w-[720px]">
              <thead><tr><th>Name</th><th>Role</th><th>Orders</th><th>Joined</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u._id}>
                    <td><div className="font-semibold">{u.name}</div><div className="text-xs text-ink-muted">{u.email}</div></td>
                    <td className="capitalize">{u.role}</td>
                    <td>{u.role === 'customer' ? u.orderCount : '–'}</td>
                    <td className="text-ink-muted">{date(u.createdAt)}</td>
                    <td className="text-ink-muted">{u.lastLoginAt ? relative(u.lastLoginAt) : 'Never'}</td>
                    <td>{u.isActive ? <span className="chip bg-market-light text-market-dark">Active</span> : <span className="chip bg-red-50 text-red-800">Suspended</span>}</td>
                    <td className="text-right">{u.role !== 'admin' && (u.isActive ? <button className="btn-danger btn-sm" onClick={() => setStatus(u, false)}>Suspend</button> : <button className="btn-ghost btn-sm" onClick={() => setStatus(u, true)}>Reactivate</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
