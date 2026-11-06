import { useState } from 'react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, PageHeader, Tabs, Badge } from '../../components/ui';
import { REQUIREMENT_STATUS, OFFER_STATUS } from '../../lib/constants';
import { money, date, relative } from '../../lib/format';

export default function AdminMarketplace() {
  const [tab, setTab] = useState('requirements');
  const reqs = useFetch('/admin/requirements', { skip: tab !== 'requirements' });
  const offers = useFetch('/offers', { params: { limit: 100 }, skip: tab !== 'offers' });
  const active = tab === 'requirements' ? reqs : offers;
  return (
    <div>
      <PageHeader title="Requirements and offers" subtitle="Monitor the reverse marketplace: what buyers ask for and how vendors respond." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'requirements', label: 'Requirements' }, { value: 'offers', label: 'Offers' }]} />
      <ErrorNote message={active.error} />
      {active.loading ? <Spinner /> : tab === 'requirements' ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="table min-w-[760px]">
            <thead><tr><th>Requirement</th><th>Customer</th><th>Qty</th><th>Budget</th><th>Needed by</th><th>Status</th><th>Posted</th></tr></thead>
            <tbody>{reqs.data?.requirements.map((r) => (
              <tr key={r._id}><td><div className="font-semibold">{r.title}</div><div className="text-xs text-ink-muted">{r.category}</div></td><td>{r.customer?.name}</td><td>{r.quantity}</td><td>{money(r.budget)}</td><td>{date(r.requiredBy)}</td><td><Badge meta={REQUIREMENT_STATUS[r.status]} /></td><td className="text-ink-muted">{relative(r.createdAt)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="table min-w-[760px]">
            <thead><tr><th>Requirement</th><th>Store</th><th>Price</th><th>Budget</th><th>Delivery</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>{offers.data?.offers.map((o) => (
              <tr key={o._id}><td className="font-semibold">{o.requirement?.title}</td><td>{o.store?.storeName}</td><td>{money(o.totalPrice)}</td><td>{money(o.requirement?.budget)}</td><td>{o.deliveryDays} days</td><td><Badge meta={OFFER_STATUS[o.status]} /></td><td className="text-ink-muted">{relative(o.createdAt)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
