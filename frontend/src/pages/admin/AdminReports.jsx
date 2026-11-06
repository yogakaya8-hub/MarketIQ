import { useState } from 'react';
import api, { errorMessage } from '../../api/client';
import useFetch from '../../lib/useFetch';
import { useToast } from '../../context/ToastContext';
import { Spinner, ErrorNote, PageHeader, Tabs, Badge, Modal, Empty } from '../../components/ui';
import { REPORT_STATUS } from '../../lib/constants';
import { relative } from '../../lib/format';
import { Inbox } from 'lucide-react';

export default function AdminReports() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch('/admin/reports', { params: status ? { status } : {} });
  const [editing, setEditing] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/reports/${editing._id}`, { status: editing.status, adminNote: editing.adminNote || '' });
      toast('Report updated and the reporter notified');
      setEditing(null);
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <div>
      <PageHeader title="Reported issues" subtitle="Problems raised by customers and vendors." />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, ...Object.entries(REPORT_STATUS).map(([v, m]) => ({ value: v, label: m.label }))]} />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data.reports.length === 0 ? <div className="panel"><Empty icon={Inbox} title="No reports here" /></div> : (
        <ul className="space-y-3">
          {data.reports.map((r) => (
            <li key={r._id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.subject}</span><Badge meta={REPORT_STATUS[r.status]} /><span className="chip bg-paper text-ink-soft capitalize">{r.category}</span></div>
                  <div className="text-xs text-ink-muted">{r.reporter?.name} ({r.reporter?.role}), {relative(r.createdAt)}{r.relatedId ? `, about ${r.relatedId}` : ''}</div>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => setEditing({ ...r })}>Update</button>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{r.description}</p>
              {r.adminNote && <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm">Reply{r.handledBy ? ` from ${r.handledBy.name}` : ''}: {r.adminNote}</p>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(editing)} title="Update report" onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <label className="block"><span className="label">Status</span><select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>{Object.entries(REPORT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}</select></label>
            <label className="block"><span className="label">Reply to the reporter</span><textarea className="input" rows={3} value={editing.adminNote || ''} onChange={(e) => setEditing({ ...editing, adminNote: e.target.value })} /></label>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary">Save and notify</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
