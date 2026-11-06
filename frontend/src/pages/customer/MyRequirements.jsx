import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader, Badge, Tabs } from '../../components/ui';
import { REQUIREMENT_STATUS } from '../../lib/constants';
import { money, date, relative } from '../../lib/format';

export default function MyRequirements() {
  const [status, setStatus] = useState('');
  const { data, loading, error } = useFetch('/requirements', { params: status ? { status } : {} });
  return (
    <div>
      <PageHeader
        title="My requirements"
        subtitle="Things you asked sellers to quote for. Open a requirement to compare offers."
        actions={<Link to="/requirements/new" className="btn-primary"><Plus size={16} /> Post a requirement</Link>}
      />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'awarded', label: 'Offer selected' }, { value: 'expired', label: 'Expired' }, { value: 'cancelled', label: 'Cancelled' }]} />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data?.requirements.length === 0 ? (
        <Empty icon={ClipboardList} title="No requirements here" action={<Link to="/requirements/new" className="btn-primary">Post your first requirement</Link>}>
          Describe what you need and vendors will send you offers.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {data?.requirements.map((r) => (
            <li key={r._id}>
              <Link to={`/requirements/${r._id}`} className="panel flex flex-col gap-3 p-4 hover:border-ink-muted/40 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.title}</span><Badge meta={REQUIREMENT_STATUS[r.status]} /></div>
                  <div className="text-sm text-ink-muted">{r.category}, qty {r.quantity}, budget {money(r.budget)}, needed by {date(r.requiredBy)}</div>
                  <div className="text-xs text-ink-muted">Posted {relative(r.createdAt)}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-display text-2xl font-bold">{r.offerCount}</div>
                  <div className="text-xs text-ink-muted">{r.offerCount === 1 ? 'offer' : 'offers'}{r.lowestOffer != null ? `, from ${money(r.lowestOffer)}` : ''}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
