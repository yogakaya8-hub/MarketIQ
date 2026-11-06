import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, PageHeader, Tabs, Badge, Modal } from '../../components/ui';
import { VENDOR_STATUS } from '../../lib/constants';
import { date } from '../../lib/format';

const ACTIONS = { pending: ['approved', 'rejected'], approved: ['suspended'], rejected: ['approved'], suspended: ['approved'] };
const VERB = { approved: 'Approve', rejected: 'Reject', suspended: 'Suspend' };

export default function AdminVendors() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch('/admin/vendors', { params: status ? { status } : {} });
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');

  const apply = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/vendors/${action.vendor._id}/status`, { status: action.to, note: note || undefined });
      toast(`${action.vendor.storeName} is now ${VENDOR_STATUS[action.to].label.toLowerCase()}`);
      setAction(null);
      setNote('');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <PageHeader title="Vendors" subtitle="Review new stores and manage existing ones. Products from stores that are not approved are hidden from shoppers." />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, ...Object.entries(VENDOR_STATUS).map(([v, m]) => ({ value: v, label: m.label }))]} />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="table min-w-[760px]">
            <thead><tr><th>Store</th><th>Owner</th><th>Categories</th><th>Products</th><th>Registered</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v._id}>
                  <td><div className="font-semibold">{v.storeName}</div><div className="text-xs text-ink-muted">{v.city}</div></td>
                  <td>{v.user?.name}<div className="text-xs text-ink-muted">{v.user?.email}</div></td>
                  <td className="max-w-[220px] text-ink-soft">{v.categories.join(', ') || '–'}</td>
                  <td>{v.productCount}</td>
                  <td className="text-ink-muted">{date(v.createdAt)}</td>
                  <td><Badge meta={VENDOR_STATUS[v.status]} /></td>
                  <td><div className="flex justify-end gap-1">{ACTIONS[v.status].map((to) => <button key={to} className={to === 'approved' ? 'btn-primary btn-sm' : 'btn-danger btn-sm'} onClick={() => setAction({ vendor: v, to })}>{VERB[to]}</button>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={Boolean(action)} title={action ? `${VERB[action.to]} ${action.vendor.storeName}?` : ''} onClose={() => setAction(null)}>
        <form onSubmit={apply} className="space-y-4">
          <label className="block"><span className="label">Note to the vendor (optional)</span><textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setAction(null)}>Cancel</button><button className={action?.to === 'approved' ? 'btn-primary' : 'btn-danger'}>{action && VERB[action.to]}</button></div>
        </form>
      </Modal>
    </div>
  );
}
