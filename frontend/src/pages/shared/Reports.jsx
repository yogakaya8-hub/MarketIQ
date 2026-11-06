import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { Spinner, Field, PageHeader, Badge } from '../../components/ui';
import { REPORT_STATUS } from '../../lib/constants';
import { relative } from '../../lib/format';

const CATS = [['order', 'An order'], ['product', 'A product listing'], ['vendor', 'A seller'], ['payment', 'Payment'], ['technical', 'Something not working'], ['other', 'Something else']];

export default function Reports() {
  const toast = useToast();
  const { data, loading, reload } = useFetch('/reports/mine');
  const [form, setForm] = useState({ category: 'order', subject: '', description: '', relatedId: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/reports', { ...form, relatedId: form.relatedId || undefined });
      toast('Report sent to the marketplace team');
      setForm({ category: 'order', subject: '', description: '', relatedId: '' });
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <PageHeader title="Report an issue" subtitle="Tell the marketplace team about a problem with an order, a listing or the site." />
        <form onSubmit={submit} className="panel space-y-4 p-5">
          <Field label="What is it about?"><select className="input" value={form.category} onChange={set('category')}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Subject"><input className="input" required minLength={3} maxLength={140} value={form.subject} onChange={set('subject')} /></Field>
          <Field label="What happened?"><textarea className="input" rows={4} required minLength={10} value={form.description} onChange={set('description')} /></Field>
          <Field label="Order number or product (optional)"><input className="input" maxLength={64} value={form.relatedId} onChange={set('relatedId')} /></Field>
          <button className="btn-primary" disabled={busy}>Send report</button>
        </form>
      </div>
      <div>
        <h2 className="mb-3 lg:mt-14">Your reports</h2>
        {loading ? <Spinner /> : data?.reports.length === 0 ? <p className="text-sm text-ink-muted">You haven&apos;t reported anything yet.</p> : (
          <ul className="space-y-2">
            {data?.reports.map((r) => (
              <li key={r._id} className="panel p-4">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{r.subject}</span><Badge meta={REPORT_STATUS[r.status]} /></div>
                <div className="text-xs text-ink-muted">{relative(r.createdAt)}</div>
                {r.adminNote && <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm">Reply: {r.adminNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
