import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, X, Clock, Store, Inbox } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AddressForm, { emptyAddress } from '../../components/AddressForm';
import { Spinner, ErrorNote, Badge, Modal, Empty } from '../../components/ui';
import { REQUIREMENT_STATUS, OFFER_STATUS } from '../../lib/constants';
import { money, date, relative } from '../../lib/format';

function Yes({ ok, children }) {
  return <span className={`inline-flex items-center gap-1 font-semibold ${ok ? 'text-market' : 'text-red-700'}`}>{ok ? <Check size={14} /> : <X size={14} />}{children}</span>;
}

export default function RequirementDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(`/requirements/${id}`);
  const [choosing, setChoosing] = useState(null);
  const [address, setAddress] = useState({ ...emptyAddress, ...(user?.address || {}) });
  const [payment, setPayment] = useState('cod');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  const { requirement: r, offers } = data;
  const open = r.status === 'open';

  const select = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put(`/offers/${choosing._id}`, { action: 'select', shippingAddress: address, paymentMethod: payment });
      toast(`Offer accepted. Order ${res.data.order.orderNumber} created.`);
      navigate(`/orders/${res.data.order._id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
      reload();
    } finally {
      setBusy(false);
      setChoosing(null);
    }
  };
  const cancel = async () => {
    if (!window.confirm('Cancel this requirement? Vendors with pending offers will be told it is closed.')) return;
    try {
      await api.patch(`/requirements/${id}/cancel`);
      toast('Requirement cancelled');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const rows = [
    ['Total price', (o) => <span className="font-display text-xl font-bold">{money(o.totalPrice)}</span>],
    ['Per unit', (o) => money(o.unitPrice)],
    ['Against your budget', (o) => o.overBudget ? <span className="font-semibold text-red-700">{money(o.budgetDifference)} over</span> : <span className="font-semibold text-market">{money(-o.budgetDifference)} under</span>],
    ['Delivery', (o) => <span className="inline-flex items-center gap-1"><Clock size={14} />{o.deliveryDays} days, by {date(o.expectedDeliveryDate)}</span>],
    ['Arrives by your date', (o) => <Yes ok={o.meetsRequiredDate}>{o.meetsRequiredDate ? 'Yes' : 'No'}</Yes>],
    ['Seller', (o) => <span><span className="font-semibold">{o.store?.storeName}</span><span className="block text-xs text-ink-muted">{o.store?.city}</span></span>],
    ['Seller track record', (o) => o.vendorRecord.totalOrders ? <span>{o.vendorRecord.deliveredOrders} delivered of {o.vendorRecord.totalOrders} orders <span className="block text-xs text-ink-muted">{o.vendorRecord.fulfilmentRate}% delivered</span></span> : <span className="text-ink-muted">No orders yet</span>],
    ['From their catalogue', (o) => (o.product ? o.product.name : <span className="text-ink-muted">Sourced for you</span>)],
    ['Seller notes', (o) => <span className="text-ink-soft">{o.details || '–'}</span>],
    ['Status', (o) => <Badge meta={OFFER_STATUS[o.status]} />],
  ];

  return (
    <div>
      <Link to="/requirements" className="text-sm text-ink-muted hover:text-ink">My requirements</Link>
      <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1>{r.title}</h1><Badge meta={REQUIREMENT_STATUS[r.status]} /></div>
          <p className="mt-2 max-w-3xl text-ink-soft">{r.description}</p>
          <p className="mt-1 text-xs text-ink-muted">Posted {relative(r.createdAt)} in {r.category}</p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
          {[['Quantity', r.quantity], ['Budget', money(r.budget)], ['Needed by', date(r.requiredBy)]].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-3"><dt className="text-xs text-ink-muted">{k}</dt><dd className="font-display text-lg font-bold">{v}</dd></div>
          ))}
        </dl>
      </div>

      {r.order && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-market-light px-4 py-3">
          <span className="text-sm">You selected an offer. Order <strong>{r.order.orderNumber}</strong> is {r.order.status}.</span>
          <Link to={`/orders/${r.order._id}`} className="btn-primary btn-sm">View order</Link>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl">Compare offers <span className="font-sans text-base font-normal text-ink-muted">({offers.length})</span></h2>
          {open && <button className="btn-danger btn-sm" onClick={cancel}>Cancel requirement</button>}
        </div>
        {offers.length === 0 ? (
          <div className="panel"><Empty icon={Inbox} title="No offers yet">{open ? 'Vendors selling in this category have been notified. Offers will appear here as they come in.' : 'This requirement closed without offers.'}</Empty></div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-44 bg-white p-3" />
                  {offers.map((o) => (
                    <th key={o._id} className={`p-3 text-left align-bottom ${o.status === 'accepted' ? 'bg-market-light' : ''}`}>
                      <div className="flex items-center gap-1.5 font-display text-base font-bold"><Store size={15} className="text-ink-muted" />{o.store?.storeName}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.tags.filter((t) => t !== 'Within budget').map((t) => <span key={t} className={`chip ${t === 'Lowest price' ? 'bg-saffron-light text-saffron-dark' : 'bg-sky-50 text-sky-800'}`}>{t}</span>)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, render]) => (
                  <tr key={label} className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-white p-3 text-left font-medium text-ink-muted">{label}</th>
                    {offers.map((o) => <td key={o._id} className={`p-3 align-top ${o.status === 'accepted' ? 'bg-market-light/60' : ''}`}>{render(o)}</td>)}
                  </tr>
                ))}
                {open && (
                  <tr className="border-t border-line">
                    <th className="sticky left-0 bg-white p-3" />
                    {offers.map((o) => (
                      <td key={o._id} className="p-3">
                        {o.status === 'pending' && <button className="btn-primary btn-sm w-full" onClick={() => setChoosing(o)}>Select this offer</button>}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={Boolean(choosing)} title={`Accept ${choosing?.store?.storeName}'s offer`} onClose={() => setChoosing(null)}>
        <form onSubmit={select} className="space-y-4">
          <div className="rounded-lg bg-paper p-3 text-sm">
            <div className="flex justify-between"><span>{r.quantity} × {r.title}</span><strong>{choosing && money(choosing.totalPrice)}</strong></div>
            <div className="text-ink-muted">Delivery in {choosing?.deliveryDays} days. Other offers will be declined automatically.</div>
          </div>
          <AddressForm value={address} onChange={setAddress} />
          <label className="flex items-center gap-2 text-sm"><input type="radio" className="accent-market" checked={payment === 'cod'} onChange={() => setPayment('cod')} /> Cash on delivery</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" className="accent-market" checked={payment === 'simulated_online'} onChange={() => setPayment('simulated_online')} /> Online payment (demo)</label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setChoosing(null)}>Back</button>
            <button className="btn-primary" disabled={busy}>{busy ? 'Placing order…' : 'Accept and place order'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
