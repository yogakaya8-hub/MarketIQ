import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, PageHeader } from '../../components/ui';

const GROUPS = [
  ['deadStock', 'Dead stock detection', [
    ['minObservationDays', 'Minimum listing age before classifying (days)'],
    ['analysisWindowDays', 'Recent sales window (days)'],
    ['slowMovingDays', 'No sale for this many days: slow-moving'],
    ['atRiskDays', 'No sale for this many days: at-risk'],
    ['deadStockDays', 'No sale for this many days: potential dead stock'],
    ['slowCoverDays', 'Stock cover above this: slow-moving (days)'],
    ['atRiskCoverDays', 'Stock cover above this: at-risk (days)'],
  ]],
  ['dropoff', 'Purchase drop-off', [
    ['abandonmentGraceHours', 'Hours of inactivity before a cart is inferred abandoned'],
    ['viewDedupMinutes', 'Repeat views within this many minutes count once'],
    ['minViewsForInsight', 'Minimum views before a low-conversion alert'],
    ['lowViewConversionPct', 'Alert when view-to-purchase is below (%)'],
    ['minCartAddsForInsight', 'Minimum cart adders before a cart alert'],
    ['lowCartConversionPct', 'Alert when cart-to-purchase is below (%)'],
    ['minCheckoutsForInsight', 'Minimum checkouts before a checkout alert'],
    ['lowCheckoutConversionPct', 'Alert when checkout completion is below (%)'],
  ]],
  ['rescue', 'Rescue deals', [
    ['minDiscountPercent', 'Minimum discount (%)'],
    ['maxDiscountPercent', 'Maximum discount (%)'],
    ['maxDurationDays', 'Longest deal (days)'],
  ]],
];

export default function AdminSettings() {
  const toast = useToast();
  const { data, loading, error } = useFetch('/admin/settings');
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data.settings); }, [data]);
  if (loading || !form) return error ? <ErrorNote message={error} /> : <Spinner />;

  const set = (g, k) => (e) => setForm({ ...form, [g]: { ...form[g], [k]: e.target.value === '' ? '' : Number(e.target.value) } });
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await api.put('/admin/settings', form);
      setForm(res.settings);
      toast('Thresholds saved. They apply to the next analysis.');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <form onSubmit={save} className="max-w-3xl">
      <PageHeader title="Intelligence thresholds" subtitle="Tune when products are flagged and when drop-off alerts appear. Stricter thresholds mean fewer, stronger alerts." actions={<button className="btn-primary">Save thresholds</button>} />
      <div className="space-y-6">
        {GROUPS.map(([g, title, fields]) => (
          <section key={g} className="panel p-5">
            <h2 className="mb-4">{title}</h2>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {fields.map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-soft">{label}</span>
                  <span className="flex items-center gap-2">
                    <input className="input w-24 text-right" type="number" min={0} required value={form[g][k]} onChange={set(g, k)} />
                    {data.defaults[g][k] !== form[g][k] && <span className="text-xs text-ink-muted" title="Default value">({data.defaults[g][k]})</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </form>
  );
}
