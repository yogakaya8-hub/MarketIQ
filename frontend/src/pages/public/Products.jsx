import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, PackageSearch } from 'lucide-react';
import { useState } from 'react';
import useFetch from '../../lib/useFetch';
import ProductCard from '../../components/ProductCard';
import { Spinner, ErrorNote, Empty, Pagination } from '../../components/ui';
import { CATEGORIES } from '../../lib/constants';

const SORTS = [['newest', 'Newest'], ['popular', 'Best selling'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name']];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const query = Object.fromEntries(params.entries());
  const { data, loading, error, reload } = useFetch('/products', { params: { limit: 12, ...query } });
  const [minP, setMinP] = useState(query.minPrice || '');
  const [maxP, setMaxP] = useState(query.maxPrice || '');

  const set = (patch) => {
    const next = { ...query, ...patch };
    if (!('page' in patch)) delete next.page;
    Object.keys(next).forEach((k) => (next[k] === '' || next[k] == null) && delete next[k]);
    setParams(next);
  };

  const filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm">Category</h3>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => set({ category: '' })} className={`rounded-md px-2 py-1 text-left text-sm ${!query.category ? 'bg-paper font-semibold' : 'text-ink-soft hover:text-ink'}`}>All categories</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => set({ category: c })} className={`rounded-md px-2 py-1 text-left text-sm ${query.category === c ? 'bg-paper font-semibold' : 'text-ink-soft hover:text-ink'}`}>{c}</button>
          ))}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); set({ minPrice: minP, maxPrice: maxP }); }}>
        <h3 className="mb-2 text-sm">Price (₹)</h3>
        <div className="flex items-center gap-2">
          <input className="input" inputMode="numeric" placeholder="Min" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" />
          <span className="text-ink-muted">to</span>
          <input className="input" inputMode="numeric" placeholder="Max" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" />
        </div>
        <button className="btn-ghost btn-sm mt-2 w-full">Apply price</button>
      </form>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-market" checked={query.inStock === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })} />
        In stock only
      </label>
      {Object.keys(query).length > 0 && <button className="link text-sm" onClick={() => { setMinP(''); setMaxP(''); setParams({}); }}>Clear all filters</button>}
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{query.q ? `Results for “${query.q}”` : query.category || 'All products'}</h1>
          {data && <p className="text-sm text-ink-muted">{data.total} product{data.total === 1 ? '' : 's'}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}><SlidersHorizontal size={16} /> Filters</button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" className="input w-auto" value={query.sort || 'newest'} onChange={(e) => set({ sort: e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} panel p-4 lg:block lg:border-0 lg:bg-transparent lg:p-0`}>{filters}</aside>
        <div>
          <ErrorNote message={error} onRetry={reload} />
          {loading ? <Spinner /> : data?.products.length === 0 ? (
            <Empty icon={PackageSearch} title="No products match" action={<Link to="/requirements/new" className="btn-primary">Post a requirement instead</Link>}>
              Try a different search or filter. If nobody lists what you need, post a requirement and sellers will send you offers.
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {data?.products.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
              <Pagination page={data?.page} pages={data?.pages} onChange={(page) => set({ page })} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
