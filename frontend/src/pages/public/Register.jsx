import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../../context/AuthContext';
import { errorMessage } from '../../api/client';
import { ErrorNote, Field } from '../../components/ui';
import { CATEGORIES } from '../../lib/constants';

export default function Register() {
  const [params] = useSearchParams();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(params.get('role') === 'vendor' ? 'vendor' : 'customer');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', storeName: '', storeDescription: '', city: '', categories: [] });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleCat = (c) => setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, role };
    if (role === 'vendor') Object.assign(payload, { storeName: form.storeName, storeDescription: form.storeDescription, city: form.city, categories: form.categories });
    try {
      const user = await register(payload);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="panel p-6 sm:p-8">
        <h1>Create an account</h1>
        <p className="mt-1 text-sm text-ink-muted">Already registered? <Link to="/login" className="link">Sign in</Link></p>
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-paper p-1" role="radiogroup" aria-label="Account type">
          {[['customer', 'I want to shop'], ['vendor', 'I want to sell']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={role === v} onClick={() => setRole(v)} className={`rounded-md py-2 text-sm font-semibold ${role === v ? 'bg-white shadow-sm' : 'text-ink-muted'}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <ErrorNote message={error} />
          <Field label="Full name"><input className="input" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Password" hint="At least 8 characters, with a letter and a number."><input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
          <Field label="Phone (optional)"><input className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
          {role === 'vendor' && (
            <div className="space-y-4 rounded-xl bg-paper p-4">
              <Field label="Store name"><input className="input" required minLength={2} value={form.storeName} onChange={set('storeName')} /></Field>
              <Field label="City"><input className="input" value={form.city} onChange={set('city')} /></Field>
              <Field label="About your store"><textarea className="input" rows={2} value={form.storeDescription} onChange={set('storeDescription')} /></Field>
              <fieldset>
                <legend className="label">What do you sell?</legend>
                <p className="mb-2 text-xs text-ink-muted">You will be notified about buyer requirements in these categories.</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button type="button" key={c} onClick={() => toggleCat(c)} aria-pressed={form.categories.includes(c)} className={`chip border px-3 py-1 ${form.categories.includes(c) ? 'border-market bg-market text-white' : 'border-line bg-white text-ink-soft'}`}>{c}</button>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-ink-muted">New stores are reviewed by an administrator before products go live.</p>
            </div>
          )}
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Creating account…' : role === 'vendor' ? 'Create vendor account' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}
