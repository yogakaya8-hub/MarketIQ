import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, Badge, Modal } from '../../components/ui';
import { ORDER_STATUS, NEXT_STATUS } from '../../lib/constants';
import { money, dateTime } from '../../lib/format';

const ACTION_LABEL = { confirmed: 'Confirm order', shipped: 'Mark as shipped', delivered: 'Mark as delivered' };

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, setData } = useFetch(`/orders/${id}`);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  const o = data.order;
  const role = user.role;
  const canCancel = ['placed', 'confirmed'].includes(o.status);
  const back = role === 'vendor' ? '/vendor/orders' : role === 'admin' ? '/admin/orders' : '/orders';

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      const res = await fn();
      setData((d) => ({ ...d, order: { ...d.order, ...res.data.order, store: d.order.store, customer: d.order.customer, requirement: d.order.requirement } }));
      toast(msg);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const advance = (status) => run(() => api.patch(`/orders/${id}/status`, { status }), `Order ${ORDER_STATUS[status].label.toLowerCase()}`);
  const cancel = async (e) => {
    e.preventDefault();
    await run(() => api.post(`/orders/${id}/cancel`, { reason: reason || undefined }), 'Order cancelled and stock restored');
    setCancelOpen(false);
  };

  return (
    <div className="max-w-4xl">
      <Link to={back} className="text-sm text-ink-muted hover:text-ink">All orders</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1>Order {o.orderNumber}</h1>
        <Badge meta={ORDER_STATUS[o.status]} />
      </div>
      <p className="mt-1 text-sm text-ink-muted">Placed {dateTime(o.createdAt)} with {o.store?.storeName}{o.source === 'requirement' && o.requirement ? `, from requirement "${o.requirement.title}"` : ''}</p>

      {(role !== 'customer' || canCancel) && o.status !== 'cancelled' && (
        <div className="mt-5 flex flex-wrap gap-2">
          {role !== 'customer' && NEXT_STATUS[o.status].map((s) => <button key={s} className="btn-primary" disabled={busy} onClick={() => advance(s)}>{ACTION_LABEL[s]}</button>)}
          {canCancel && <button className="btn-danger" disabled={busy} onClick={() => setCancelOpen(true)}>Cancel order</button>}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="panel">
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i._id} className="flex justify-between gap-4 p-4">
                <div>
                  {i.product && role === 'customer' ? <Link to={`/products/${i.product}`} className="font-semibold hover:underline">{i.name}</Link> : <span className="font-semibold">{i.name}</span>}
                  <div className="text-sm text-ink-muted">
                    {i.quantity} × {money(i.unitPrice)}
                    {i.rescueDeal && i.originalUnitPrice > i.unitPrice && <span className="ml-2 font-semibold text-saffron-dark">Rescue deal (was {money(i.originalUnitPrice)})</span>}
                  </div>
                </div>
                <div className="font-semibold">{money(i.lineTotal)}</div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line p-4 font-display text-lg font-bold"><span>Total</span><span>{money(o.totalAmount)}</span></div>
        </section>
        <aside className="space-y-4">
          <div className="panel p-4 text-sm">
            <h3 className="mb-2">Deliver to</h3>
            {role !== 'customer' && o.customer && (
              <div className="mb-2 space-y-0.5">
                <div className="font-semibold">{o.customer.name}</div>
                {o.customer.phone && <div className="flex items-center gap-1.5 text-ink-muted"><Phone size={13} />{o.customer.phone}</div>}
                <div className="flex items-center gap-1.5 text-ink-muted"><Mail size={13} />{o.customer.email}</div>
              </div>
            )}
            <div className="flex gap-1.5 text-ink-soft"><MapPin size={14} className="mt-0.5 shrink-0" /><span>{o.shippingAddress.line1}, {o.shippingAddress.city}{o.shippingAddress.state ? `, ${o.shippingAddress.state}` : ''} {o.shippingAddress.postalCode}</span></div>
            <div className="mt-2 text-ink-muted">Payment: {o.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online (demo)'}</div>
          </div>
          <div className="panel p-4">
            <h3 className="mb-3">Progress</h3>
            <ol className="relative space-y-3 border-l-2 border-line pl-4">
              {o.statusHistory.map((h, idx) => (
                <li key={idx} className="text-sm">
                  <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ${h.status === 'cancelled' ? 'bg-slate-400' : 'bg-market'}`} />
                  <div className="font-semibold">{ORDER_STATUS[h.status]?.label}</div>
                  <div className="text-xs text-ink-muted">{dateTime(h.at)}</div>
                  {h.note && <div className="text-xs text-ink-soft">{h.note}</div>}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <Modal open={cancelOpen} title="Cancel this order?" onClose={() => setCancelOpen(false)}>
        <form onSubmit={cancel} className="space-y-4">
          <p className="text-sm text-ink-soft">Stock is returned to the store and the {role === 'customer' ? 'seller' : 'customer'} is notified.</p>
          <label className="block"><span className="label">Reason (optional)</span><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setCancelOpen(false)}>Keep order</button><button className="btn-danger" disabled={busy}>Cancel order</button></div>
        </form>
      </Modal>
    </div>
  );
}
