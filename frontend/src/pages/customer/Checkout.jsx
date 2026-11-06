import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import AddressForm, { emptyAddress } from '../../components/AddressForm';
import { Spinner, ErrorNote, PageHeader } from '../../components/ui';
import { money } from '../../lib/format';

export default function Checkout() {
  const { user, setUser } = useAuth();
  const { cart, refresh, setCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [address, setAddress] = useState({ ...emptyAddress, ...(user?.address || {}) });
  const [payment, setPayment] = useState('cod');
  const [save, setSave] = useState(!user?.address?.line1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);
  if (!cart) return <Spinner />;
  if (cart.items.length === 0) return <p>Your cart is empty. <Link to="/products" className="link">Continue shopping</Link></p>;

  const stores = new Set(cart.items.map((i) => i.product?.store?._id)).size;

  const place = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/orders', { shippingAddress: address, paymentMethod: payment });
      if (save) {
        const res = await api.put('/auth/me', { address }).catch(() => null);
        if (res) setUser(res.data.user);
      }
      setCart({ ...cart, items: [], itemCount: 0, subtotal: 0 });
      toast(`Order placed: ${data.orders.map((o) => o.orderNumber).join(', ')}`);
      navigate(data.orders.length === 1 ? `/orders/${data.orders[0]._id}` : '/orders', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={place}>
      <PageHeader title="Checkout" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ErrorNote message={error} />
          <section className="panel p-5">
            <h2 className="mb-4">Delivery address</h2>
            <AddressForm value={address} onChange={setAddress} />
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-market" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save this address to my account</label>
          </section>
          <section className="panel p-5">
            <h2 className="mb-3">Payment</h2>
            {[['cod', 'Cash on delivery', 'Pay when the order arrives.'], ['simulated_online', 'Online payment (demo)', 'Simulated for this project; no money is charged.']].map(([v, l, d]) => (
              <label key={v} className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${payment === v ? 'border-market bg-market-light/50' : 'border-line'}`}>
                <input type="radio" name="payment" className="mt-1 accent-market" checked={payment === v} onChange={() => setPayment(v)} />
                <span><span className="block text-sm font-semibold">{l}</span><span className="text-xs text-ink-muted">{d}</span></span>
              </label>
            ))}
          </section>
        </div>
        <aside className="panel h-fit p-5">
          <h2 className="mb-3">Your order</h2>
          <ul className="space-y-2 text-sm">
            {cart.items.map((i) => i.product && (
              <li key={i.product._id} className="flex justify-between gap-3"><span className="text-ink-soft">{i.quantity} × {i.product.name}</span><span className="font-semibold">{money(i.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg font-bold"><span>Total</span><span>{money(cart.subtotal)}</span></div>
          {stores > 1 && <p className="mt-2 text-xs text-ink-muted">This will create {stores} orders, one per store.</p>}
          <button className="btn-primary mt-4 w-full py-2.5" disabled={busy || cart.hasProblems}>{busy ? 'Placing order…' : `Place order · ${money(cart.subtotal)}`}</button>
        </aside>
      </div>
    </form>
  );
}
