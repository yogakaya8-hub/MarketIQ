import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ClipboardList, TrendingDown, MousePointerClick, BadgePercent } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorNote, PageHeader, Stat } from '../../components/ui';
import { money, number } from '../../lib/format';
import { RISK } from '../../lib/constants';
import { SINGLE, AXIS, GRID, TOOLTIP, compactINR } from '../../lib/chart';

const monthLabel = (p) => new Date(`${p}-01`).toLocaleDateString('en-IN', { month: 'short' });

export default function VendorDashboard() {
  const { vendor } = useAuth();
  const { data, loading, error, reload } = useFetch('/analytics/vendor-summary');
  const drop = useFetch('/analytics/purchase-dropoff', { params: { days: 30 } });
  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  const s = data.summary;
  const flagged = (s.riskDistribution.dead_stock || 0) + (s.riskDistribution.at_risk || 0) + (s.riskDistribution.slow_moving || 0);
  const topInsights = drop.data?.insights?.slice(0, 2) || [];

  return (
    <div>
      <PageHeader title={`Welcome back, ${vendor?.storeName}`} subtitle="Sales, fulfilment and the signals that need your attention." actions={<Link to="/vendor/products/new" className="btn-primary">Add product</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue, last 30 days" value={money(s.revenue30d)} tone="good" />
        <Stat label="Orders, last 30 days" value={number(s.orders30d)} />
        <Stat label="Orders to fulfil" value={s.openOrders} hint="Placed or confirmed" tone={s.openOrders ? 'deal' : undefined} />
        <Stat label="Products" value={s.productCount} hint={`${s.lowStock} low stock, ${s.outOfStock} out of stock`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-4">
          <h2 className="text-base">Monthly sales</h2>
          <p className="mb-2 text-xs text-ink-muted">Revenue from orders that were not cancelled</p>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={s.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="period" {...AXIS} tickFormatter={monthLabel} />
                <YAxis {...AXIS} tickFormatter={compactINR} width={52} />
                <Tooltip {...TOOLTIP} labelFormatter={monthLabel} formatter={(v, n, p) => [`${money(v)} from ${p.payload.orderCount} orders`, 'Revenue']} />
                <Bar dataKey="totalSales" fill={SINGLE} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3">
          <Link to="/vendor/inventory" className="panel block p-4 hover:border-ink-muted/40">
            <div className="flex items-center gap-2 font-semibold"><TrendingDown size={17} className="text-risk-dead" /> Dead stock alerts</div>
            <p className="mt-1 text-sm text-ink-muted">{flagged ? `${flagged} product${flagged === 1 ? '' : 's'} show slow-selling signals.` : 'All products are selling normally.'}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {['dead_stock', 'at_risk', 'slow_moving'].map((k) => (
                <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK[k].dot }} />{RISK[k].label} <strong>{s.riskDistribution[k] || 0}</strong></span>
              ))}
            </div>
          </Link>
          <Link to="/vendor/requirements" className="panel block p-4 hover:border-ink-muted/40">
            <div className="flex items-center gap-2 font-semibold"><ClipboardList size={17} className="text-market" /> Buyer requirements</div>
            <p className="mt-1 text-sm text-ink-muted">{s.openRequirements} open in your categories, {s.pendingOffers} of your offers awaiting a decision.</p>
          </Link>
          <Link to="/vendor/deals" className="panel block p-4 hover:border-ink-muted/40">
            <div className="flex items-center gap-2 font-semibold"><BadgePercent size={17} className="text-saffron-dark" /> Rescue deals</div>
            <p className="mt-1 text-sm text-ink-muted">{s.activeDeals} running now.</p>
          </Link>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-2 text-base">Top products, last 30 days</h2>
          {s.topProducts.length === 0 ? <p className="text-sm text-ink-muted">No sales in the last 30 days.</p> : (
            <table className="table">
              <thead><tr><th>Product</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{s.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td className="text-right">{p.units}</td><td className="text-right font-semibold">{money(p.revenue)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
        <section className="panel p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base"><MousePointerClick size={17} /> Where shoppers drop off</h2><Link to="/vendor/insights" className="link text-sm">All insights</Link></div>
          {drop.loading ? <Spinner /> : topInsights.length === 0 ? <p className="text-sm text-ink-muted">No drop-off issues detected in the last 30 days.</p> : (
            <ul className="space-y-3">
              {topInsights.map((i) => (
                <li key={`${i.productId}-${i.type}`} className="border-l-4 border-risk-atrisk pl-3 text-sm">
                  <div className="font-semibold">{i.title}: {i.productName}</div>
                  <div className="text-ink-soft">{i.observed}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
