import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, PageHeader, Stat } from '../../components/ui';
import { money, number } from '../../lib/format';
import { RISK, RISK_ORDER, ORDER_STATUS } from '../../lib/constants';
import { SINGLE, AXIS, GRID, TOOLTIP, compactINR } from '../../lib/chart';

const monthLabel = (p) => new Date(`${p}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch('/analytics/platform');
  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  const s = data.summary;
  const riskTotal = RISK_ORDER.reduce((n, k) => n + (s.riskDistribution[k] || 0), 0) || 1;
  const req = s.requirementsByStatus;

  return (
    <div>
      <PageHeader title="Marketplace overview" subtitle="Sales, participants and the intelligence signals across all stores." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales, last 30 days" value={money(s.gmv30d)} hint={`${number(s.orders30d)} orders`} tone="good" />
        <Stat label="Customers" value={number(s.usersByRole.customer || 0)} />
        <Stat label="Approved vendors" value={s.vendorsByStatus.approved || 0} hint={s.vendorsByStatus.pending ? `${s.vendorsByStatus.pending} waiting for review` : 'None waiting for review'} tone={s.vendorsByStatus.pending ? 'deal' : undefined} />
        <Stat label="Open issues" value={s.openReports} hint="Reported by users" tone={s.openReports ? 'risk' : undefined} />
      </div>
      {s.vendorsByStatus.pending > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
          <span>{s.vendorsByStatus.pending} new store{s.vendorsByStatus.pending > 1 ? 's' : ''} waiting for approval.</span>
          <Link to="/admin/vendors" className="font-semibold underline">Review stores</Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-4">
          <h2 className="text-base">Monthly platform sales</h2>
          <p className="mb-2 text-xs text-ink-muted">All stores, excluding cancelled orders</p>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={s.monthly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="period" {...AXIS} tickFormatter={monthLabel} />
                <YAxis {...AXIS} tickFormatter={compactINR} width={56} />
                <Tooltip {...TOOLTIP} labelFormatter={monthLabel} formatter={(v, n, p) => [`${money(v)} from ${p.payload.orderCount} orders`, 'Sales']} />
                <Bar dataKey="totalSales" fill={SINGLE} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="text-base">Sales by category, 30 days</h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer>
              <BarChart data={s.categorySales.slice(0, 7)} layout="vertical" margin={{ left: 4, right: 56 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" {...AXIS} width={128} />
                <Tooltip {...TOOLTIP} formatter={(v) => [money(v), 'Sales']} />
                <Bar dataKey="revenue" fill={SINGLE} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="revenue" position="right" formatter={compactINR} fill="#3A4566" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base">Inventory risk</h2><Link to="/admin/inventory" className="link text-sm">Details</Link></div>
          <div className="mb-3 flex h-3 gap-0.5 overflow-hidden rounded-full">
            {RISK_ORDER.filter((k) => s.riskDistribution[k]).map((k) => <div key={k} style={{ width: `${(s.riskDistribution[k] / riskTotal) * 100}%`, backgroundColor: RISK[k].dot }} />)}
          </div>
          <ul className="space-y-1 text-sm">
            {RISK_ORDER.map((k) => <li key={k} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK[k].dot }} />{RISK[k].label}</span><strong>{s.riskDistribution[k] || 0}</strong></li>)}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">{s.activeDeals} rescue deal{s.activeDeals === 1 ? '' : 's'} running.</p>
        </section>
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base">Reverse marketplace</h2><Link to="/admin/marketplace" className="link text-sm">Details</Link></div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-muted">Open requirements</dt><dd className="font-display text-xl font-bold">{req.open || 0}</dd></div>
            <div><dt className="text-ink-muted">Offers selected</dt><dd className="font-display text-xl font-bold">{req.awarded || 0}</dd></div>
            <div><dt className="text-ink-muted">Expired unfilled</dt><dd className="font-display text-xl font-bold">{req.expired || 0}</dd></div>
            <div><dt className="text-ink-muted">Offers per requirement</dt><dd className="font-display text-xl font-bold">{s.avgOffersPerRequirement}</dd></div>
          </dl>
        </section>
        <section className="panel p-4">
          <h2 className="mb-3 text-base">Top stores, 30 days</h2>
          <ul className="space-y-2 text-sm">
            {s.topVendors.map((v, i) => <li key={v.storeName} className="flex justify-between gap-2"><span><span className="mr-2 text-ink-muted">{i + 1}</span>{v.storeName}</span><span className="font-semibold">{money(v.revenue)}</span></li>)}
          </ul>
          <div className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            Orders by status: {Object.entries(s.ordersByStatus).map(([k, v]) => `${ORDER_STATUS[k]?.label || k} ${v}`).join(', ')}
          </div>
        </section>
      </div>
    </div>
  );
}
