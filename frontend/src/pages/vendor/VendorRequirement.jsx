import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, Field, Badge } from '../../components/ui';
import { OFFER_STATUS, REQUIREMENT_STATUS } from '../../lib/constants';
import { money, date } from '../../lib/format';

export default function VendorRequirement() {
  const { id } = useParams();
  const { vendor } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/requirements/${id}`);
  const [form, setForm] = useState({ totalPrice: '', deliveryDays: 5, details: '', productId: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const o = data?.myOffer;
    if (o) setForm({ totalPrice: o.totalPrice, deliveryDays: o.deliveryDays, details: o.details || '', productId: o.product?._id || '' });
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  const { requirement: r, myOffer, offerCount, myMatchingProducts } = data;
  const maxDays = Math.max(0, Math.floor((new Date(r.requiredBy) - Date.now()) / 86400000));
  const editable = r.status === 'open' && (!myOffer || ['pending', 'withdrawn'].includes(myOffer.status));
  const approved = vendor?.status === 'approved';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const linked = myMatchingProducts.find((p) => p._id === form.productId);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const body = { totalPrice: Number(form.totalPrice), deliveryDays: Number(form.deliveryDays), details: form.details };
    try {
      if (myOffer) await api.put(`/offers/${myOffer._id}`, { action: 'update', ...body, productId: form.productId || null });
      else await api.post('/offers', { requirementId: id, ...body, ...(form.productId ? { productId: form.productId } : {}) });
      toast(myOffer ? 'Offer updated' : 'Offer sent to the buyer');
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!window.confirm('Withdraw your offer? You can resubmit while the requirement is open.')) return;
    try {
      await api.put(`/offers/${myOffer._id}`, { action: 'withdraw' });
      toast('Offer withdrawn');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div className="max-w-5xl">
      <Link to="/vendor/requirements" className="text-sm text-ink-muted hover:text-ink">Requirement board</Link>
      <div className="mt-2 flex flex-wrap items-center gap-2"><h1>{r.title}</h1><Badge meta={REQUIREMENT_STATUS[r.status]} /></div>
      <p className="mt-1 text-sm text-ink-muted">{r.category}, requested by {r.customer?.name}{r.customer?.city ? ` in ${r.customer.city}` : ''}. {offerCount} offer{offerCount === 1 ? '' : 's'} received so far.</p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section className="panel p-5">
          <h2 className="mb-2">What the buyer needs</h2>
          <p className="whitespace-pre-line text-ink-soft">{r.description}</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 rounded-lg bg-paper p-4 text-center">
            <div><dt className="text-xs text-ink-muted">Quantity</dt><dd className="font-display text-xl font-bold">{r.quantity}</dd></div>
            <div><dt className="text-xs text-ink-muted">Total budget</dt><dd className="font-display text-xl font-bold">{money(r.budget)}</dd><dd className="text-xs text-ink-muted">{money(Math.round(r.budget / r.quantity))} / unit</dd></div>
            <div><dt className="text-xs text-ink-muted">Needed by</dt><dd className="font-display text-xl font-bold">{date(r.requiredBy)}</dd><dd className="text-xs text-ink-muted">{maxDays} days from today</dd></div>
          </dl>
          {r.order && myOffer?.status === 'accepted' && (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-market-light px-4 py-3 text-sm">
              <span>The buyer accepted your offer. Order <strong>{r.order.orderNumber}</strong>.</span>
              <Link to={`/vendor/orders/${r.order._id}`} className="btn-primary btn-sm">Open order</Link>
            </div>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2>{myOffer ? 'Your offer' : 'Send an offer'}</h2>
            {myOffer && <Badge meta={OFFER_STATUS[myOffer.status]} />}
          </div>
          {!approved ? <p className="text-sm text-ink-muted">Offers unlock once your store is approved.</p> : !editable ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Total price</dt><dd className="font-semibold">{money(myOffer?.totalPrice)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd className="font-semibold">{myOffer?.deliveryDays} days</dd></div>
              {myOffer?.details && <div><dt className="text-ink-muted">Notes</dt><dd>{myOffer.details}</dd></div>}
              {!myOffer && <p className="text-ink-muted">This requirement is no longer accepting offers.</p>}
            </dl>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {formError && <ErrorNote message={formError} />}
              {myMatchingProducts.length > 0 && (
                <Field label="Supply from your catalogue (optional)" hint="Stock is reserved automatically if the buyer accepts.">
                  <select className="input" value={form.productId} onChange={set('productId')}>
                    <option value="">Not linked to a catalogue product</option>
                    {myMatchingProducts.map((p) => <option key={p._id} value={p._id} disabled={p.stock < r.quantity}>{p.name} ({p.stock} in stock{p.stock < r.quantity ? ', not enough' : ''})</option>)}
                  </select>
                </Field>
              )}
              <Field label={`Total price for ${r.quantity} units (₹)`} hint={form.totalPrice ? `${money(Math.round((form.totalPrice / r.quantity) * 100) / 100)} per unit${Number(form.totalPrice) > r.budget ? `, ${money(form.totalPrice - r.budget)} over the buyer's budget` : ''}` : linked ? `Your list price would be ${money(linked.price * r.quantity)}` : undefined}>
                <input className="input" type="number" min={1} step="0.01" required value={form.totalPrice} onChange={set('totalPrice')} />
              </Field>
              <Field label="Delivery time (days)" hint={`Must arrive by ${date(r.requiredBy)}: at most ${maxDays} days.`}>
                <input className="input" type="number" min={1} max={Math.max(1, maxDays)} required value={form.deliveryDays} onChange={set('deliveryDays')} />
              </Field>
              <Field label="Notes for the buyer"><textarea className="input" rows={3} maxLength={1500} value={form.details} onChange={set('details')} placeholder="Brand, warranty, customisation, packaging" /></Field>
              <div className="flex flex-wrap justify-end gap-2">
                {myOffer?.status === 'pending' && <button type="button" className="btn-danger" onClick={withdraw}>Withdraw offer</button>}
                <button className="btn-primary" disabled={busy}>{myOffer ? (myOffer.status === 'withdrawn' ? 'Resubmit offer' : 'Update offer') : 'Send offer'}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
