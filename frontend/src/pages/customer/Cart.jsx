import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, Empty, Modal, PageHeader, Price } from '../../components/ui';
import { money } from '../../lib/format';
import { REMOVAL_REASONS } from '../../lib/constants';

export default function Cart() {
  const { cart, refresh, update, remove } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh(); }, [refresh]);
  if (!cart) return <Spinner />;

  const change = async (productId, quantity) => {
    try { await update(productId, quantity); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const confirmRemove = async () => {
    try {
      await remove(removing.product._id, reason || undefined);
      toast('Removed from cart');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
    setRemoving(null);
    setReason('');
  };
  const checkout = async () => {
    setBusy(true);
    try {
      await api.post('/cart/checkout-intent');
      navigate('/checkout');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (cart.items.length === 0) {
    return <Empty icon={ShoppingCart} title="Your cart is empty" action={<Link to="/products" className="btn-primary">Browse products</Link>}>Items you add will appear here.</Empty>;
  }

  return (
    <div>
      <PageHeader title="Your cart" subtitle={`${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="panel divide-y divide-line">
          {cart.items.map((item) => item.product && (
            <li key={item.product._id} className="flex gap-4 p-4">
              <Link to={`/products/${item.product._id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg"><ProductArt product={item.product} size={28} /></Link>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.product._id}`} className="font-semibold hover:underline">{item.product.name}</Link>
                <div className="text-xs text-ink-muted">{item.product.store?.storeName}</div>
                <div className="mt-1"><Price product={item.product} /></div>
                {item.problem && <div className="mt-1 text-sm font-semibold text-red-700">{item.problem}</div>}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-line">
                    <button className="p-1.5 disabled:opacity-40" disabled={item.quantity <= 1} onClick={() => change(item.product._id, item.quantity - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <button className="p-1.5 disabled:opacity-40" disabled={item.quantity >= item.product.stock} onClick={() => change(item.product._id, item.quantity + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
                  </div>
                  <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-red-700" onClick={() => setRemoving(item)}><Trash2 size={14} /> Remove</button>
                </div>
              </div>
              <div className="text-right font-display font-bold">{money(item.lineTotal)}</div>
            </li>
          ))}
        </ul>
        <aside className="panel h-fit p-5">
          <h2 className="mb-3">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{money(cart.subtotal)}</dd></div>
            {cart.savings > 0 && <div className="flex justify-between text-saffron-dark"><dt>Rescue deal savings</dt><dd className="font-semibold">−{money(cart.savings)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd className="font-semibold">Free</dd></div>
          </dl>
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg font-bold"><span>Total</span><span>{money(cart.subtotal)}</span></div>
          {cart.hasProblems && <p className="mt-3 text-sm text-red-700">Some items can&apos;t be ordered. Adjust or remove them to continue.</p>}
          <button className="btn-primary mt-4 w-full py-2.5" disabled={busy || cart.hasProblems} onClick={checkout}>Proceed to checkout</button>
          <p className="mt-2 text-xs text-ink-muted">Items from different stores are delivered as separate orders.</p>
        </aside>
      </div>

      <Modal open={Boolean(removing)} title="Remove from cart?" onClose={() => { setRemoving(null); setReason(''); }}>
        <p className="text-sm text-ink-soft">{removing?.product?.name}</p>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Want to tell the seller why? (optional)</legend>
          <p className="mb-2 text-xs text-ink-muted">Your answer is shared anonymously and helps sellers improve.</p>
          <div className="grid gap-1.5">
            {REMOVAL_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" name="reason" className="accent-market" checked={reason === r} onChange={() => setReason(r)} /> {r}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => { setRemoving(null); setReason(''); }}>Keep it</button>
          <button className="btn-danger" onClick={confirmRemove}>Remove item</button>
        </div>
      </Modal>
    </div>
  );
}
