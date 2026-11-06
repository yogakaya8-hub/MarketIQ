import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader, Badge, Tabs } from '../../components/ui';
import { OFFER_STATUS, REQUIREMENT_STATUS } from '../../lib/constants';
import { money, date, relative } from '../../lib/format';

export default function VendorOffers() {
  const [status, setStatus] = useState('');
  const { data, loading, error } = useFetch('/offers/mine', { params: status ? { status } : {} });
  return (
    <div>
      <PageHeader title="My offers" subtitle="Offers you sent on buyer requirements." actions={<Link to="/vendor/requirements" className="btn-primary">Find requirements</Link>} />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, ...Object.entries(OFFER_STATUS).map(([v, m]) => ({ value: v, label: m.label }))]} />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data?.offers.length === 0 ? <div className="panel"><Empty icon={HandCoins} title="No offers here" /></div> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="table min-w-[760px]">
            <thead><tr><th>Requirement</th><th>Qty</th><th>Buyer budget</th><th>Your price</th><th>Delivery</th><th>Offer</th><th>Requirement</th><th>Sent</th></tr></thead>
            <tbody>
              {data.offers.map((o) => (
                <tr key={o._id}>
                  <td><Link to={`/vendor/requirements/${o.requirement?._id}`} className="link">{o.requirement?.title}</Link><div className="text-xs text-ink-muted">Needed by {date(o.requirement?.requiredBy)}</div></td>
                  <td>{o.requirement?.quantity}</td>
                  <td>{money(o.requirement?.budget)}</td>
                  <td className="font-semibold">{money(o.totalPrice)}</td>
                  <td>{o.deliveryDays} days</td>
                  <td><Badge meta={OFFER_STATUS[o.status]} /></td>
                  <td><Badge meta={REQUIREMENT_STATUS[o.requirement?.status]} /></td>
                  <td className="text-ink-muted">{relative(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
