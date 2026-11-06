import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, BadgePercent, Lightbulb, SearchCheck, Info } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, ErrorNote, Empty, PageHeader, RiskBadge, Tabs, Modal, Field } from '../../components/ui';
import { RISK, RISK_ORDER } from '../../lib/constants';
import { money, date, timeLeft } from '../../lib/format';

const FLAGGED = ['dead_stock', 'at_risk', 'slow_moving'];

function Distribution({ summary, total }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Inventory risk distribution">
        {RISK_ORDER.filter((k) => summary[k]).map((k) => (
          <div key={k} style={{ width: `${(summary[k] / total) * 100}%`, backgroundColor: RISK[k].dot }} title={`${RISK[k].label}: ${summary[k]}`} />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {RISK_ORDER.map((k) => (
          <div key={k}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK[k].dot }} />{RISK[k].label}</dt>
            <dd className="font-display text-2xl font-bold">{summary[k] || 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function InventoryIntelligence() {
  const { user } = useAuth();
  const isVendor = user.role === 'vendor';
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/inventory/dead-stock');
  const limits = useFetch('/rescue-deals/mine', { skip: !isVendor });
  const [tab, setTab] = useState('flagged');
  const [dealFor, setDealFor] = useState(null);
  const [deal, setDeal] = useState({ discountPercent: 20, durationDays: 7 });
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => {
    if (!data) return [];
    if (tab === 'flagged') return data.items.filter((i) => FLAGGED.includes(i.riskStatus));
    if (tab === 'all') return data.items;
    return data.items.filter((i) => i.riskStatus === tab);
  }, [data, tab]);

  if (loading) return <Spinner label="Analysing inventory" />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  const t = data.thresholds;
  const lim = limits.data?.limits || { minDiscountPercent: 5, maxDiscountPercent: 70, maxDurationDays: 30 };
  const flaggedCount = FLAGGED.reduce((s, k) => s + (data.summary[k] || 0), 0);

  const createDeal = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/rescue-deals', { productId: dealFor.product, ...deal });
      toast(`Rescue deal is live for ${dealFor.productInfo.name}`);
      setDealFor(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isVendor ? 'Dead stock alerts' : 'Inventory risk across the marketplace'}
        subtitle="Each product is classified from its real order history: days since the last sale, sales in the recent window and how long current stock would last at that rate. High stock alone never triggers an alert."
        actions={<button className="btn-ghost btn-sm" onClick={reload}>Re-run analysis</button>}
      />
      <Distribution summary={data.summary} total={data.items.length || 1} />

      <details className="mt-3 rounded-lg bg-white/60 px-4 py-2 text-sm text-ink-soft">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink"><Info size={15} /> How products are classified</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Products listed less than {t.minObservationDays} days ago show <strong>Insufficient data</strong> instead of a guess.</li>
          <li>No sale (or never sold since listing) for {t.slowMovingDays} / {t.atRiskDays} / {t.deadStockDays} days: slow-moving / at-risk / potential dead stock.</li>
          <li>Stock that would last {t.slowCoverDays}+ days (slow-moving) or {t.atRiskCoverDays}+ days (at-risk) at the sales rate of the last {t.analysisWindowDays} days.</li>
          <li>Out-of-stock products are never flagged. Administrators can change these thresholds.</li>
        </ul>
      </details>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'flagged', label: 'Needs attention', count: flaggedCount },
            ...RISK_ORDER.map((k) => ({ value: k, label: RISK[k].label, count: data.summary[k] || 0 })),
            { value: 'all', label: 'All', count: data.items.length },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div className="panel"><Empty icon={SearchCheck} title="Nothing in this view">{tab === 'flagged' ? 'No product currently shows slow-moving, at-risk or dead-stock signals.' : 'No products in this category.'}</Empty></div>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => {
            const rescuable = isVendor && FLAGGED.includes(i.riskStatus) && !i.activeDeal && i.stock > 0 && i.productInfo.isActive;
            return (
              <li key={i.product} className="panel overflow-hidden">
                <div className="flex flex-col gap-4 p-4 md:flex-row">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"><ProductArt product={i.productInfo} size={26} /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{i.productInfo.name}</span>
                        <RiskBadge status={i.riskStatus} />
                      </div>
                      <div className="text-xs text-ink-muted">{!isVendor && `${i.productInfo.storeName}, `}{i.productInfo.category}, {money(i.productInfo.price)}</div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                        <div><dt className="text-xs text-ink-muted">In stock</dt><dd className="font-semibold">{i.stock}</dd></div>
                        <div><dt className="text-xs text-ink-muted">Sold, last {i.metrics.windowDays}d</dt><dd className="font-semibold">{i.salesCount} unit{i.salesCount === 1 ? '' : 's'}</dd></div>
                        <div><dt className="text-xs text-ink-muted">Days since last sale</dt><dd className="font-semibold">{i.daysSinceLastSale ?? (i.totalUnitsSold === 0 ? 'Never sold' : '–')}</dd></div>
                        <div><dt className="text-xs text-ink-muted">Last sale</dt><dd className="font-semibold">{i.lastSaleDate ? date(i.lastSaleDate) : '–'}</dd></div>
                      </dl>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                    {i.activeDeal && <span className="chip bg-saffron-light text-saffron-dark"><BadgePercent size={13} /> {i.activeDeal.discountPercent}% deal, {timeLeft(i.activeDeal.endsAt)}</span>}
                    {rescuable && <button className="btn-deal btn-sm" onClick={() => { setDealFor(i); setDeal({ discountPercent: i.riskStatus === 'dead_stock' ? 30 : i.riskStatus === 'at_risk' ? 20 : 10, durationDays: 7 }); }}><BadgePercent size={15} /> Create rescue deal</button>}
                    {isVendor && <Link to={`/vendor/products/${i.product}/edit`} className="text-xs font-semibold text-ink-muted hover:text-ink">Edit product</Link>}
                  </div>
                </div>
                {i.riskStatus !== 'healthy' && (
                  <div className="grid gap-4 border-t border-line bg-paper/60 p-4 text-sm md:grid-cols-2">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5 font-semibold"><TrendingDown size={14} /> {i.riskStatus === 'insufficient_data' ? 'Why there is no classification' : 'Evidence'}</div>
                      <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    </div>
                    {i.suggestedActions.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center gap-1.5 font-semibold"><Lightbulb size={14} /> Suggested actions</div>
                        <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">{i.suggestedActions.map((a) => <li key={a}>{a}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(dealFor)} title="Create a rescue deal" onClose={() => setDealFor(null)}>
        {dealFor && (
          <form onSubmit={createDeal} className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-paper p-3">
              <div className="h-12 w-12 overflow-hidden rounded-md"><ProductArt product={dealFor.productInfo} size={20} /></div>
              <div className="flex-1"><div className="font-semibold">{dealFor.productInfo.name}</div><RiskBadge status={dealFor.riskStatus} /></div>
            </div>
            <Field label={`Discount: ${deal.discountPercent}%`} hint={`Allowed range ${lim.minDiscountPercent}% to ${lim.maxDiscountPercent}%`}>
              <input type="range" className="w-full accent-saffron" min={lim.minDiscountPercent} max={lim.maxDiscountPercent} value={deal.discountPercent} onChange={(e) => setDeal({ ...deal, discountPercent: Number(e.target.value) })} />
            </Field>
            <Field label="Duration">
              <select className="input" value={deal.durationDays} onChange={(e) => setDeal({ ...deal, durationDays: Number(e.target.value) })}>
                {[3, 7, 14, 21, 30].filter((d) => d <= lim.maxDurationDays).map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </Field>
            <div className="flex items-baseline justify-between rounded-lg border-2 border-saffron bg-saffron-light px-4 py-3">
              <span className="text-sm">Deal price</span>
              <span><span className="mr-2 text-sm text-ink-muted line-through">{money(dealFor.productInfo.price)}</span><span className="font-display text-2xl font-bold">{money(Math.max(1, Math.round(dealFor.productInfo.price * (1 - deal.discountPercent / 100) * 100) / 100))}</span></span>
            </div>
            <p className="text-xs text-ink-muted">The product appears on the public Rescue Deals page. Your base price is unchanged and the deal ends automatically.</p>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setDealFor(null)}>Cancel</button><button className="btn-deal" disabled={busy}>Publish deal</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
