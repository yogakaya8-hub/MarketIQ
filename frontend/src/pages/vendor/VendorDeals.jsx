import { Link } from 'react-router-dom';
import { BadgePercent } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, ErrorNote, Empty, PageHeader, RiskBadge } from '../../components/ui';
import { money, date, timeLeft } from '../../lib/format';

const STATUS = { active: 'bg-saffron-light text-saffron-dark', expired: 'bg-slate-100 text-slate-600', cancelled: 'bg-slate-100 text-slate-600' };

export default function VendorDeals() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/rescue-deals/mine');
  const end = async (d) => {
    if (!window.confirm('End this deal now? The product returns to its normal price.')) return;
    try {
      await api.patch(`/rescue-deals/${d._id}/cancel`);
      toast('Deal ended');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <div>
      <PageHeader title="Rescue deals" subtitle="Time-limited discounts on slow-moving stock. Create new deals from Dead stock alerts, where each product's evidence is shown." actions={<Link to="/vendor/inventory" className="btn-deal">Find stock to rescue</Link>} />
      <ErrorNote message={error} onRetry={reload} />
      {loading ? <Spinner /> : data?.deals.length === 0 ? <div className="panel"><Empty icon={BadgePercent} title="No rescue deals yet" action={<Link to="/vendor/inventory" className="btn-deal">Open dead stock alerts</Link>}>Start from a flagged product to publish a deal.</Empty></div> : (
        <ul className="space-y-3">
          {data.deals.map((d) => (
            <li key={d._id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"><ProductArt product={d.product} size={22} /></div>
                <div>
                  <div className="font-semibold">{d.product?.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`chip ${STATUS[d.status]}`}>{d.status === 'active' ? timeLeft(d.endsAt) : d.status === 'expired' ? 'Expired' : 'Ended early'}</span>
                    {d.riskStatusAtCreation && <span className="flex items-center gap-1 text-ink-muted">Flagged as <RiskBadge status={d.riskStatusAtCreation} /></span>}
                  </div>
                  <div className="text-xs text-ink-muted">{date(d.startsAt)} to {date(d.endsAt)}</div>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-sm sm:w-[360px]">
                <div><dt className="text-xs text-ink-muted">Price</dt><dd className="font-semibold">{money(d.dealPrice)}</dd><dd className="text-xs text-ink-muted line-through">{money(d.originalPrice)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Units sold</dt><dd className="font-semibold">{d.unitsSold}</dd><dd className="text-xs text-ink-muted">of {d.stockAtCreation} in stock</dd></div>
                <div><dt className="text-xs text-ink-muted">Recovered</dt><dd className="font-semibold">{money(d.revenue)}</dd></div>
              </dl>
              {d.status === 'active' && <button className="btn-ghost btn-sm" onClick={() => end(d)}>End deal</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
