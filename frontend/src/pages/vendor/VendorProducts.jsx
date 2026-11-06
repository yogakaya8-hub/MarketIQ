import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, ErrorNote, Empty, PageHeader } from '../../components/ui';
import { money, date } from '../../lib/format';

export default function VendorProducts() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useFetch('/vendor/products', { params: q ? { q } : {} });

  const toggle = async (p) => {
    try {
      await api.put(`/products/${p._id}`, { isActive: !p.isActive });
      toast(p.isActive ? 'Product hidden from the shop' : 'Product is visible in the shop');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? Past orders keep their records.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      toast('Product deleted');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div>
      <PageHeader title="Products" subtitle="Your catalogue, prices and stock." actions={<Link to="/vendor/products/new" className="btn-primary">Add product</Link>} />
      <input className="input mb-4 max-w-sm" placeholder="Search your products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your products" />
      <ErrorNote message={error} onRetry={reload} />
      {loading ? <Spinner /> : data?.products.length === 0 ? (
        <Empty icon={Package} title="No products yet" action={<Link to="/vendor/products/new" className="btn-primary">Add your first product</Link>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="table min-w-[760px]">
            <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Sold</th><th>Last sale</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {data?.products.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md"><ProductArt product={p} size={18} /></div>
                      <div><div className="font-semibold">{p.name}</div><div className="text-xs text-ink-muted">{p.category}{p.sku ? `, ${p.sku}` : ''}</div></div>
                    </div>
                  </td>
                  <td>{money(p.price)}{p.deal && <div className="text-xs font-semibold text-saffron-dark">Deal {money(p.deal.dealPrice)}</div>}</td>
                  <td className={p.stock === 0 ? 'font-semibold text-red-700' : p.stock <= 5 ? 'font-semibold text-orange-700' : ''}>{p.stock}</td>
                  <td>{p.salesCount}</td>
                  <td className="text-ink-muted">{date(p.lastSaleDate)}</td>
                  <td>
                    {p.isBlocked ? <span className="chip bg-red-50 text-red-800" title={p.blockReason}>Hidden by admin</span> : p.isActive ? <span className="chip bg-market-light text-market-dark">Live</span> : <span className="chip bg-slate-100 text-slate-600">Hidden</span>}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="rounded-md p-1.5 text-ink-muted hover:bg-paper" onClick={() => toggle(p)} aria-label={p.isActive ? 'Hide from shop' : 'Show in shop'} title={p.isActive ? 'Hide from shop' : 'Show in shop'}>{p.isActive ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      <Link to={`/vendor/products/${p._id}/edit`} className="rounded-md p-1.5 text-ink-muted hover:bg-paper" aria-label="Edit" title="Edit"><Pencil size={16} /></Link>
                      <button className="rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-700" onClick={() => remove(p)} aria-label="Delete" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
