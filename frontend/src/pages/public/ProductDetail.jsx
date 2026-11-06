import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, MapPin, Store, Truck, ClipboardList, Clock } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import ProductCard from '../../components/ProductCard';
import { Spinner, ErrorNote, Price } from '../../components/ui';
import { date, timeLeft } from '../../lib/format';
import { visitorSessionId } from '../../lib/session';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(`/products/${id}`);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  // Record a product view. The server de-duplicates repeat views and ignores vendor/admin views.
  useEffect(() => {
    api.post(`/products/${id}/events`, { eventType: 'product_viewed', ...(user ? {} : { sessionId: visitorSessionId() }) }).catch(() => {});
    setQty(1);
  }, [id, user]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  const { product, vendorStats, related } = data;
  const out = product.stock <= 0;
  const store = product.store || {};

  const addToCart = async (goToCart) => {
    if (!user) return navigate('/login', { state: { from: `/products/${id}` } });
    setBusy(true);
    try {
      await add(product._id, qty);
      toast(`Added ${qty} × ${product.name} to your cart`);
      if (goToCart) navigate('/cart');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <nav className="text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link to="/products" className="hover:text-ink">Products</Link> / <Link to={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">{product.category}</Link>
      </nav>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line">
          <ProductArt product={product} size={120} />
          {product.deal && (
            <div className="absolute left-0 top-5 rounded-r-full bg-saffron px-4 py-2 text-sm font-bold text-ink">
              Rescue deal: {product.deal.discountPercent}% off
            </div>
          )}
        </div>
        <div>
          {product.brand && <div className="text-sm font-semibold text-market">{product.brand}</div>}
          <h1 className="mt-1 text-3xl">{product.name}</h1>
          <div className="mt-4"><Price product={product} size="lg" /></div>
          {product.deal && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-saffron-dark"><Clock size={14} /> Deal price ends {date(product.deal.endsAt)} ({timeLeft(product.deal.endsAt)})</p>
          )}
          <p className={`mt-3 text-sm font-semibold ${out ? 'text-red-700' : product.stock <= 5 ? 'text-orange-700' : 'text-market'}`}>
            {out ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left` : 'In stock'}
          </p>

          {(!user || user.role === 'customer') && !out && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-line bg-white">
                <button className="p-2.5 disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus size={16} /></button>
                <span className="w-10 text-center font-semibold" aria-live="polite">{qty}</span>
                <button className="p-2.5 disabled:opacity-40" onClick={() => setQty((q) => Math.min(product.stock, 99, q + 1))} disabled={qty >= Math.min(product.stock, 99)} aria-label="Increase quantity"><Plus size={16} /></button>
              </div>
              <button className="btn-primary px-5 py-2.5" disabled={busy} onClick={() => addToCart(false)}><ShoppingCart size={18} /> Add to cart</button>
              <button className="btn-ghost px-5 py-2.5" disabled={busy} onClick={() => addToCart(true)}>Buy now</button>
            </div>
          )}
          {user && user.role !== 'customer' && <p className="mt-6 rounded-lg bg-paper px-4 py-3 text-sm text-ink-muted">You are signed in as {user.role}. Shopping is available to customer accounts.</p>}

          {product.description && (
            <div className="mt-8">
              <h2 className="mb-2">About this product</h2>
              <p className="whitespace-pre-line text-ink-soft">{product.description}</p>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-line bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-paper p-2"><Store size={20} className="text-ink-soft" /></div>
              <div className="flex-1">
                <div className="text-xs text-ink-muted">Sold by</div>
                <Link to={`/stores/${store._id}`} className="font-display text-lg font-bold hover:underline">{store.storeName}</Link>
                {store.description && <p className="text-sm text-ink-muted">{store.description}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {store.city && <div><dt className="text-ink-muted">Ships from</dt><dd className="flex items-center gap-1 font-semibold"><MapPin size={13} />{store.city}</dd></div>}
                  <div><dt className="text-ink-muted">Selling since</dt><dd className="font-semibold">{date(store.createdAt)}</dd></div>
                  <div><dt className="text-ink-muted">Delivered orders</dt><dd className="flex items-center gap-1 font-semibold"><Truck size={13} />{vendorStats.deliveredOrders}</dd></div>
                </dl>
              </div>
            </div>
          </div>

          <Link to={`/requirements/new?category=${encodeURIComponent(product.category)}`} className="mt-4 flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
            <ClipboardList size={16} /> Need a bulk quantity or something slightly different? Post a requirement.
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3">More in {product.category}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{related.map((p) => <ProductCard key={p._id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
