import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../../context/AuthContext';
import { errorMessage } from '../../api/client';
import { ErrorNote, Field } from '../../components/ui';

const DEMO = [
  ['Customer', 'priya@marketplace.test', 'Customer@123'],
  ['Vendor', 'technest@marketplace.test', 'Vendor@123'],
  ['Admin', 'admin@marketplace.test', 'Admin@123'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      const from = location.state?.from;
      navigate(from && user.role === 'customer' ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="panel p-6 sm:p-8">
        <h1>Sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">New here? <Link to="/register" className="link">Create an account</Link></p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <ErrorNote message={error} />
          <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-line p-4 text-sm">
        <div className="mb-2 font-semibold text-ink-soft">Demo accounts (from the seed data)</div>
        <div className="grid gap-1.5">
          {DEMO.map(([role, email, pw]) => (
            <button key={role} type="button" onClick={() => setForm({ email, password: pw })} className="flex items-center justify-between rounded-md px-2 py-1 text-left hover:bg-white">
              <span className="font-semibold">{role}</span><span className="text-ink-muted">{email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
