import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend, Cell, LabelList } from 'recharts';
import { Eye, ShoppingCart, CreditCard, CheckCircle2, AlertTriangle, MessageSquareQuote, BookOpen } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { Spinner, ErrorNote, Empty, PageHeader, Tabs } from '../../components/ui';
import { number, pct, dateTime } from '../../lib/format';
import { SERIES, SINGLE, AXIS, GRID, TOOLTIP } from '../../lib/chart';

const RANGES = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }];
const shortDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted"><Icon size={15} />{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

function InsightCard({ insight }) {
  const high = insight.severity === 'high';
  return (
    <article className={`panel border-l-4 p-4 ${high ? 'border-l-risk-dead' : 'border-l-risk-slow'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={16} className={high ? 'text-risk-dead' : 'text-risk-slow'} />
        <h3>{insight.title}</h3>
        <span className="text-sm text-ink-muted">{insight.productName}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-ink-muted">{insight.metric}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex gap-2"><dt className="w-20 shrink-0"><span className="chip bg-ink text-white">Observed</span></dt><dd>{insight.observed}</dd></div>
        {insight.inferred && <div className="flex gap-2"><dt className="w-20 shrink-0"><span className="chip border border-dashed border-ink-muted text-ink-soft">Inferred</span></dt><dd className="text-ink-soft">{insight.inferred.replace(/^Inferred:\s*/, '')}</dd></div>}
        {insight.statedReasons && <div className="flex gap-2"><dt className="w-20 shrink-0"><span className="chip bg-saffron-light text-saffron-dark"><MessageSquareQuote size={12} /> Said</span></dt><dd className="text-ink-soft">{insight.statedReasons.replace(/^Customer-stated removal reasons:\s*/, 'Customers who removed it chose: ')}</dd></div>}
      </dl>
      <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">
        <span className="font-semibold">Worth reviewing</span> <span className="text-ink-muted">(possible factors, not confirmed causes)</span>
        <ul className="mt-1 list-disc pl-5 text-ink-soft">{insight.reviewAreas.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
    </article>
  );
}

export default function DropoffInsights() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [view, setView] = useState('insights');
  const { data, loading, error, reload } = useFetch('/analytics/purchase-dropoff', { params: { days } });

  const header = (
    <PageHeader
      title={user.role === 'admin' ? 'Purchase drop-off across the marketplace' : 'Purchase drop-off insights'}
      subtitle="Where shoppers lose interest between viewing a product and buying it, calculated from recorded events and orders. Observed facts and inferred abandonment are labelled separately."
      actions={
        <div className="flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => <button key={r.value} role="radio" aria-checked={days === r.value} onClick={() => setDays(r.value)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${days === r.value ? 'bg-ink text-white' : 'text-ink-soft'}`}>{r.label}</button>)}
        </div>
      }
    />
  );
  if (loading && !data) return <>{header}<Spinner label="Calculating" /></>;
  if (error) return <>{header}<ErrorNote message={error} onRetry={reload} /></>;
  const { totals: t, insights, products, daily, removalReasons, definitions, graceHours } = data;
  const funnel = t.funnel || [];

  return (
    <div>
      {header}
      {products.length === 0 ? (
        <div className="panel"><Empty icon={Eye} title="No shopper activity in this period">Insights appear once shoppers start viewing your products.</Empty></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Eye} label="Product views" value={number(t.views)} sub={`${number(t.viewers)} shopper–product pairs`} />
            <Kpi icon={ShoppingCart} label="Add-to-cart actions" value={number(t.addEvents)} sub={`${number(t.removals)} removed from cart`} />
            <Kpi icon={CreditCard} label="Checkouts started" value={number(t.checkoutsInitiated)} sub={`${pct(t.checkoutConversionPct)} completed`} />
            <Kpi icon={CheckCircle2} label="Completed purchases" value={number(t.purchases)} sub={`${pct(t.cartConversionPct)} of cart adders bought`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="panel p-4">
              <h2 className="text-base">Buying journey</h2>
              <p className="mb-2 text-xs text-ink-muted">Shopper–product pairs reaching each step in the last {days} days</p>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }} barCategoryGap={10}>
                    <CartesianGrid {...GRID} horizontal={false} vertical />
                    <XAxis type="number" {...AXIS} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" {...AXIS} width={110} />
                    <Tooltip {...TOOLTIP} formatter={(v) => [number(v), 'Shoppers']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {funnel.map((f) => <Cell key={f.stage} fill={SINGLE} />)}
                      <LabelList dataKey="value" position="right" fill="#3A4566" fontSize={12} formatter={number} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
                <div><div className="font-display text-lg font-bold text-ink">{pct(t.viewConversionPct)}</div><div className="text-ink-muted">viewers who bought</div></div>
                <div><div className="font-display text-lg font-bold text-ink">{number(t.inferredCartAbandoned)}</div><div className="text-ink-muted">carts inferred abandoned</div></div>
                <div><div className="font-display text-lg font-bold text-ink">{number(t.removedAfterAdd)}</div><div className="text-ink-muted">explicitly removed</div></div>
              </div>
            </section>
            <section className="panel p-4">
              <h2 className="text-base">Daily cart and purchase activity</h2>
              <p className="mb-2 text-xs text-ink-muted">Views are charted separately below because they run at a much larger scale.</p>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={daily} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="date" {...AXIS} tickFormatter={shortDay} minTickGap={24} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip {...TOOLTIP} labelFormatter={shortDay} cursor={{ stroke: '#9AA1B8', strokeWidth: 1 }} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="addToCart" name="Added to cart" stroke={SERIES[0]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="checkouts" name="Checkouts started" stroke={SERIES[1]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="purchases" name="Purchases" stroke={SERIES[2]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 h-20 border-t border-line pt-2">
                <div className="text-xs text-ink-muted">Daily product views</div>
                <ResponsiveContainer>
                  <BarChart data={daily} margin={{ left: -12, right: 8, top: 2, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis {...AXIS} width={40} allowDecimals={false} tickCount={3} />
                    <Tooltip {...TOOLTIP} labelFormatter={shortDay} formatter={(v) => [number(v), 'Views']} />
                    <Bar dataKey="views" fill={SINGLE} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="mt-8">
            <Tabs value={view} onChange={setView} tabs={[{ value: 'insights', label: 'Actionable insights', count: insights.length }, { value: 'products', label: 'By product', count: products.length }, { value: 'definitions', label: 'How it is measured' }]} />
          </div>

          {view === 'insights' && (
            insights.length === 0 ? <div className="panel"><Empty icon={CheckCircle2} title="No drop-off problems detected">No product crossed the alert thresholds in this period.</Empty></div> : (
              <div className="grid gap-3 xl:grid-cols-2">{insights.map((i) => <InsightCard key={`${i.productId}-${i.type}`} insight={i} />)}</div>
            )
          )}

          {view === 'products' && (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="table min-w-[860px]">
                <thead><tr><th>Product</th><th>Views</th><th>Added to cart</th><th>Checkouts</th><th>Purchases</th><th>View → buy</th><th>Cart → buy</th><th title={`No activity for ${graceHours}h after adding, not removed, not bought`}>Inferred abandoned</th><th>Removed</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.productId}>
                      <td><div className="font-semibold">{p.name}</div>{user.role === 'admin' && <div className="text-xs text-ink-muted">{p.storeName}</div>}</td>
                      <td>{number(p.views)}</td><td>{number(p.addEvents)}</td><td>{number(p.checkoutsInitiated)}</td><td>{number(p.purchases)}</td>
                      <td className={p.viewConversionPct != null && p.viewConversionPct < 3 ? 'font-semibold text-risk-dead' : ''}>{pct(p.viewConversionPct)}</td>
                      <td className={p.cartConversionPct != null && p.cartConversionPct < 35 ? 'font-semibold text-risk-dead' : ''}>{pct(p.cartConversionPct)}</td>
                      <td>{number(p.inferredCartAbandoned)}</td><td>{number(p.removedAfterAdd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'definitions' && (
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <dl className="panel divide-y divide-line">
                {Object.entries(definitions).map(([k, v]) => (
                  <div key={k} className="p-3 text-sm"><dt className="font-semibold capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd className="text-ink-soft">{v}</dd></div>
                ))}
              </dl>
              <div className="panel h-fit p-4">
                <h3 className="mb-2 flex items-center gap-2"><BookOpen size={16} /> Reasons customers gave</h3>
                <p className="mb-3 text-xs text-ink-muted">Only shown when a shopper chose a reason while removing an item. Everything else is unknown, and this page does not guess.</p>
                {removalReasons.length === 0 ? <p className="text-sm text-ink-muted">No reasons given in this period.</p> : (
                  <ul className="space-y-1 text-sm">{removalReasons.map((r) => <li key={r.reason} className="flex justify-between"><span>{r.reason}</span><span className="font-semibold">{r.count}</span></li>)}</ul>
                )}
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-ink-muted">Generated {dateTime(data.generatedAt)}.</p>
        </>
      )}
    </div>
  );
}
