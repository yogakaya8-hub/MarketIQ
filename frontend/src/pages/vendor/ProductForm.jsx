import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ProductArt from '../../components/ProductArt';
import { Spinner, ErrorNote, Field, PageHeader } from '../../components/ui';
import { CATEGORIES } from '../../lib/constants';

const blank = { name: '', description: '', category: '', brand: '', sku: '', price: '', stock: '', imageUrl: '', isActive: true };

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get('/vendor/products').then(({ data }) => {
      const p = data.products.find((x) => x._id === id);
      if (!p) setError('Product not found in your catalogue');
      else setForm({ ...blank, ...p, brand: p.brand || '', sku: p.sku || '', imageUrl: p.imageUrl || '' });
    }).catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: form.name, description: form.description, category: form.category, brand: form.brand || undefined,
      sku: form.sku || undefined, price: Number(form.price), stock: Number(form.stock), imageUrl: form.imageUrl || '', isActive: form.isActive,
    };
    try {
      if (id) await api.put(`/products/${id}`, body);
      else await api.post('/products', body);
      toast(id ? 'Product updated' : 'Product added');
      navigate('/vendor/products');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  return (
    <div className="max-w-3xl">
      <Link to="/vendor/products" className="text-sm text-ink-muted hover:text-ink">Products</Link>
      <PageHeader title={id ? 'Edit product' : 'Add a product'} />
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_200px]">
        <div className="panel space-y-4 p-5">
          <ErrorNote message={error} />
          <Field label="Product name"><input className="input" required minLength={2} maxLength={120} value={form.name} onChange={set('name')} /></Field>
          <Field label="Description"><textarea className="input" rows={4} maxLength={3000} value={form.description} onChange={set('description')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><select className="input" required value={form.category} onChange={set('category')}><option value="" disabled>Choose</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Brand"><input className="input" maxLength={60} value={form.brand} onChange={set('brand')} /></Field>
            <Field label="Price (₹)"><input className="input" type="number" min={1} step="0.01" required value={form.price} onChange={set('price')} /></Field>
            <Field label="Stock quantity"><input className="input" type="number" min={0} step={1} required value={form.stock} onChange={set('stock')} /></Field>
            <Field label="SKU (optional)"><input className="input" maxLength={40} value={form.sku} onChange={set('sku')} /></Field>
            <Field label="Image URL (optional)" hint="Leave empty to use generated category artwork."><input className="input" type="url" value={form.imageUrl} onChange={set('imageUrl')} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-market" checked={form.isActive} onChange={set('isActive')} /> Visible in the shop</label>
          <div className="flex justify-end gap-2"><Link to="/vendor/products" className="btn-ghost">Cancel</Link><button className="btn-primary" disabled={busy}>{id ? 'Save changes' : 'Add product'}</button></div>
        </div>
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-line"><ProductArt product={form} size={56} /></div>
          <p className="mt-2 text-xs text-ink-muted">Preview</p>
        </div>
      </form>
    </div>
  );
}
