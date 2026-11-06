import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Field, PageHeader, Badge } from '../../components/ui';
import { CATEGORIES, VENDOR_STATUS } from '../../lib/constants';

export default function StoreProfile() {
  const { vendor, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ storeName: '', description: '', city: '', phone: '', categories: [] });
  useEffect(() => { if (vendor) setForm({ storeName: vendor.storeName, description: vendor.description || '', city: vendor.city || '', phone: vendor.phone || '', categories: vendor.categories || [] }); }, [vendor]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (c) => setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/vendor/profile', form);
      await refresh();
      toast('Store profile saved');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Store profile" actions={vendor && <Badge meta={VENDOR_STATUS[vendor.status]} />} />
      {vendor?.statusNote && <p className="mb-4 rounded-lg bg-paper px-4 py-3 text-sm">Note from the marketplace team: {vendor.statusNote}</p>}
      <form onSubmit={submit} className="panel space-y-4 p-5">
        <Field label="Store name"><input className="input" required minLength={2} value={form.storeName} onChange={set('storeName')} /></Field>
        <Field label="About the store"><textarea className="input" rows={3} value={form.description} onChange={set('description')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><input className="input" value={form.city} onChange={set('city')} /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <fieldset>
          <legend className="label">Categories you sell</legend>
          <p className="mb-2 text-xs text-ink-muted">Used to show you relevant buyer requirements and notify you about new ones.</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => <button type="button" key={c} onClick={() => toggle(c)} aria-pressed={form.categories.includes(c)} className={`chip border px-3 py-1 ${form.categories.includes(c) ? 'border-market bg-market text-white' : 'border-line bg-white text-ink-soft'}`}>{c}</button>)}
          </div>
        </fieldset>
        <button className="btn-primary">Save profile</button>
      </form>
    </div>
  );
}
