import { useState } from 'react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, PageHeader, Pagination } from '../../components/ui';
import { dateTime } from '../../lib/format';

const FILTERS = [['', 'All activity'], ['order', 'Orders'], ['offer', 'Offers'], ['requirement', 'Requirements'], ['rescue_deal', 'Rescue deals'], ['product', 'Products'], ['vendor', 'Vendors'], ['user', 'Users'], ['report', 'Reports'], ['settings', 'Settings']];

export default function AdminActivity() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch('/admin/activity', { params: { page, ...(action ? { action } : {}) } });
  return (
    <div>
      <PageHeader title="System activity" subtitle="An audit trail of important actions across the marketplace." />
      <select className="input mb-4 w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter activity">
        {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ErrorNote message={error} />
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="table min-w-[680px]">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>{data.logs.map((l) => (
                <tr key={l._id}><td className="whitespace-nowrap text-ink-muted">{dateTime(l.createdAt)}</td><td>{l.actor?.name || 'System'}<div className="text-xs capitalize text-ink-muted">{l.actorRole}</div></td><td><code className="rounded bg-paper px-1.5 py-0.5 text-xs">{l.action}</code></td><td className="text-ink-soft">{l.summary}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
