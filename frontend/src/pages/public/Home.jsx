import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, BadgePercent, Store } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import ProductCard from '../../components/ProductCard';
import ProductArt from '../../components/ProductArt';
import { Spinner } from '../../components/ui';
import { money, timeLeft } from '../../lib/format';

const STEPS = [
  ['Describe what you need', 'Quantity, budget and the date you need it by.'],
  ['Sellers send offers', 'Vendors who can supply it reply with a price and delivery time.'],
  ['Compare side by side', 'Price, delivery date and each seller\'s track record in one table.'],
  ['Pick one and order', 'Your order is created with the seller you chose.'],
];

export default function Home() {
  const navigate = useNavigate();
  const [need, setNeed] = useState('');
  const popular = useFetch('/products', { params: { sort: 'popular', limit: 8 } });
  const deals = useFetch('/rescue-deals');
  const cats = useFetch('/products/categories');

  const start = (e) => {
    e.preventDefault();
    navigate(`/requirements/new${need.trim() ? `?title=${encodeURIComponent(need.trim())}` : ''}`);
  };

  return (
    <div className="space-y-12">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl bg-ink px-6 py-8 text-white sm:px-10 sm:py-12">
          <h1 className="max-w-xl font-display text-3xl font-extrabold leading-[1.1] text-white sm:text-5xl">
            Can&apos;t find it? Tell sellers what you need.
          </h1>
          <p className="mt-4 max-w-lg text-white/75">
            Shop from independent stores across India, or post a requirement and let vendors compete with offers.
          </p>
          <form onSubmit={start} className="mt-7 flex max-w-xl flex-col gap-2 sm:flex-row">
            <label htmlFor="need" className="sr-only">What do you need?</label>
            <input id="need" className="input border-transparent py-3 text-base" placeholder="e.g. 50 insulated bottles for my office team" value={need} onChange={(e) => setNeed(e.target.value)} />
            <button className="btn-deal px-5 py-3 text-base">Post requirement</button>
          </form>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
            <Link to="/products" className="hover:text-white">Browse all products</Link>
            <Link to="/stores" className="hover:text-white">Meet the stores</Link>
          </div>
        </div>

        <div className="self-start rounded-2xl border-2 border-saffron bg-saffron-light p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2"><BadgePercent size={20} className="text-saffron-dark" /> Rescue deals</h2>
            <Link to="/deals" className="text-sm font-semibold text-saffron-dark hover:underline">See all</Link>
          </div>
          <p className="mb-4 text-sm text-ink-soft">Limited-time prices on stock sellers want to clear.</p>
          {deals.loading ? <Spinner /> : (
            <ul className="space-y-2">
              {(deals.data?.deals || []).slice(0, 4).map((d) => (
                <li key={d._id}>
                  <Link to={`/products/${d.product._id}`} className="flex items-center gap-3 rounded-xl bg-white p-2 hover:shadow-lift">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"><ProductArt product={d.product} size={24} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.product.name}</div>
                      <div className="text-xs text-ink-muted">{timeLeft(d.endsAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold">{money(d.dealPrice)}</div>
                      <div className="text-xs font-bold text-saffron-dark">{d.discountPercent}% off</div>
                    </div>
                  </Link>
                </li>
              ))}
              {deals.data?.deals?.length === 0 && <li className="text-sm text-ink-muted">No deals running right now.</li>}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="mb-3">Shop by category</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(cats.data?.categories || []).filter((c) => c.count > 0).map((c) => (
            <Link key={c.name} to={`/products?category=${encodeURIComponent(c.name)}`} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-4 text-sm font-semibold hover:border-ink-muted/50">
              <span className="h-8 w-8 overflow-hidden rounded-full"><ProductArt product={{ category: c.name }} size={16} /></span>
              {c.name} <span className="font-normal text-ink-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="popular">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="popular">Popular right now</h2>
          <Link to="/products?sort=popular" className="link text-sm">View more</Link>
        </div>
        {popular.loading ? <Spinner /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {popular.data?.products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 sm:p-8" aria-labelledby="how">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="how" className="flex items-center gap-2 text-xl"><ClipboardList size={22} className="text-market" /> How a requirement works</h2>
          <Link to="/requirements/new" className="btn-primary btn-sm self-start">Post a requirement</Link>
        </div>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="border-l-2 border-market pl-4">
              <div className="font-display text-3xl font-extrabold text-market/30">{i + 1}</div>
              <div className="font-semibold">{t}</div>
              <p className="text-sm text-ink-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-2xl bg-market-light p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2"><Store size={20} className="text-market" /> Sell on the marketplace</h2>
          <p className="text-sm text-ink-soft">Get alerts on stock that isn&apos;t moving, see where shoppers drop off, and answer buyer requirements.</p>
        </div>
        <Link to="/register?role=vendor" className="btn-ink">Open a store</Link>
      </section>
    </div>
  );
}
