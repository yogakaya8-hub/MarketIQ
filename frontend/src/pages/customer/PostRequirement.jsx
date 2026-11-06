import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ErrorNote, Field, PageHeader } from '../../components/ui';
import { CATEGORIES } from '../../lib/constants';
import { money, todayPlus } from '../../lib/format';

export default function PostRequirement() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    title: params.get('title') || '',
    description: '',
    category: params.get('category') || '',
    quantity: 1,
    budget: '',
    requiredBy: todayPlus(14),
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/requirements', { ...form, quantity: Number(form.quantity), budget: Number(form.budget) });
      toast('Requirement posted. Matching vendors have been notified.');
      navigate(`/requirements/${data.requirement._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const perUnit = form.budget && form.quantity > 0 ? Number(form.budget) / Number(form.quantity) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post a requirement" subtitle="Describe what you need. Vendors who can supply it will send offers with their price and delivery time, and you choose the one you want." />
      <form onSubmit={submit} className="panel space-y-4 p-5 sm:p-6">
        <ErrorNote message={error} />
        <Field label="What do you need?"><input className="input" required minLength={3} maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Insulated steel water bottles" /></Field>
        <Field label="Details" hint="Size, material, colour, brand preferences, where it should be delivered."><textarea className="input" rows={4} required minLength={10} maxLength={2000} value={form.description} onChange={set('description')} /></Field>
        <Field label="Category">
          <select className="input" required value={form.category} onChange={set('category')}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quantity"><input className="input" type="number" min={1} max={100000} required value={form.quantity} onChange={set('quantity')} /></Field>
          <Field label="Total budget (₹)" hint={perUnit ? `About ${money(Math.round(perUnit))} per unit` : undefined}><input className="input" type="number" min={1} required value={form.budget} onChange={set('budget')} /></Field>
          <Field label="Needed by"><input className="input" type="date" min={todayPlus(0)} max={todayPlus(365)} required value={form.requiredBy} onChange={set('requiredBy')} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post requirement'}</button>
        </div>
      </form>
    </div>
  );
}
