import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, MapPin, CalendarClock } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader, Badge } from '../../components/ui';
import { CATEGORIES, OFFER_STATUS } from '../../lib/constants';
import { money, date, relative } from '../../lib/format';

const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000));

export default function RequirementBoard() {
  const [relevant, setRelevant] = useState(true);
  const [category, setCategory] = useState('');
  const { data, loading, error, reload } = useFetch('/requirements', { params: { relevant: String(relevant), ...(category ? { category } : {}) } });
  return (
    <div>
      <PageHeader title="Requirement board" subtitle="Open buyer requirements. Send an offer with your total price and delivery time; the buyer compares offers and picks one." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Which requirements">
          {[[true, 'My categories'], [false, 'All categories']].map(([v, l]) => (
            <button key={l} role="radio" aria-checked={relevant === v} onClick={() => setRelevant(v)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${relevant === v ? 'bg-ink text-white' : 'text-ink-soft'}`}>{l}</button>
          ))}
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">Any category</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <ErrorNote message={error} onRetry={reload} />
      {loading ? <Spinner /> : data?.requirements.length === 0 ? (
        <div className="panel"><Empty icon={ClipboardList} title="No open requirements">{relevant ? 'Nothing in your categories right now. Try "All categories", or add categories in your store profile.' : 'Check back later.'}</Empty></div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data?.requirements.map((r) => {
            const left = daysLeft(r.requiredBy);
            return (
              <li key={r._id} className="panel flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={`/vendor/requirements/${r._id}`} className="font-display text-lg font-bold hover:underline">{r.title}</Link>
                    <div className="text-xs text-ink-muted">{r.category}, posted {relative(r.createdAt)} by {r.customer?.name}{r.customer?.city ? ` in ${r.customer.city}` : ''}</div>
                  </div>
                  {r.myOffer && <Badge meta={OFFER_STATUS[r.myOffer.status]}>Your offer: {OFFER_STATUS[r.myOffer.status].label.toLowerCase()}</Badge>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.description}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-ink-muted">Quantity</dt><dd className="font-semibold">{r.quantity}</dd></div>
                  <div><dt className="text-xs text-ink-muted">Budget</dt><dd className="font-semibold">{money(r.budget)}</dd></div>
                  <div><dt className="text-xs text-ink-muted">Needed by</dt><dd className={`flex items-center gap-1 font-semibold ${left <= 5 ? 'text-orange-700' : ''}`}><CalendarClock size={13} />{date(r.requiredBy)}</dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm text-ink-muted">{r.offerCount} offer{r.offerCount === 1 ? '' : 's'} so far, {left} day{left === 1 ? '' : 's'} left</span>
                  <Link to={`/vendor/requirements/${r._id}`} className={r.myOffer ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}>{r.myOffer ? 'View your offer' : 'Send an offer'}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
