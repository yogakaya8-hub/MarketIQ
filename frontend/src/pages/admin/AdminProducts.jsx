import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, ErrorNote, PageHeader, Pagination, Tabs } from '../../components/ui';
import { money } from '../../lib/format';

export default function AdminProducts() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [blocked, setBlocked] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/admin/products', { params: { page, ...(q ? { q } : {}), ...(blocked ? { blocked } : {}) } });
  const moderate = async (p, isBlocked) => {
    const reason = isBlocked ? window.prompt('Reason for hiding this product (shared with the vendor):') : undefined;
    if (isBlocked && reason === null) return;
    try {
      await api.patch(`/admin/products/${p._id}/moderation`, { isBlocked, reason: reason || undefined });
      toast(isBlocked ? 'Product hidden from shoppers' : 'Product restored');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <div>
      <PageHeader title="Products" subtitle="Monitor listings across all stores and hide ones that break marketplace rules." />
      <Tabs value={blocked} onChange={(v) => { setBlocked(v); setPage(1); }} tabs={[{ value: '', label: 'All products' }, { value: 'true', label: 'Hidden by admin' }]} />
      <input className="input mb-4 max-w-sm" placeholder="Search products" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search products" />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="table min-w-[760px]">
              <thead><tr><th>Product</th><th>Store</th><th>Price</th><th>Stock</th><th>Sold</th><th>Visibility</th><th /></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p._id}>
                    <td><div className="flex items-center gap-3"><div className="h-9 w-9 shrink-0 overflow-hidden rounded-md"><ProductArt product={p} size={16} /></div><div><div className="font-semibold">{p.name}</div><div className="text-xs text-ink-muted">{p.category}</div></div></div></td>
                    <td>{p.store?.storeName}{p.store?.status !== 'approved' && <div className="text-xs text-amber-700">Store {p.store?.status}</div>}</td>
                    <td>{money(p.price)}{p.deal && <div className="text-xs font-semibold text-saffron-dark">Deal {money(p.deal.dealPrice)}</div>}</td>
                    <td>{p.stock}</td>
                    <td>{p.salesCount}</td>
                    <td>{p.isBlocked ? <span className="chip bg-red-50 text-red-800" title={p.blockReason}>Hidden by admin</span> : p.isActive ? <span className="chip bg-market-light text-market-dark">Live</span> : <span className="chip bg-slate-100 text-slate-600">Hidden by vendor</span>}</td>
                    <td className="text-right">{p.isBlocked ? <button className="btn-ghost btn-sm" onClick={() => moderate(p, false)}>Restore</button> : <button className="btn-danger btn-sm" onClick={() => moderate(p, true)}>Hide</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
