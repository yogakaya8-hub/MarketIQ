import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { money } from '../lib/format';
import { RISK } from '../lib/constants';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-muted" role="status">
      <Loader2 className="animate-spin" size={20} /> <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {message}
      {onRetry && <button className="ml-3 font-semibold underline" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon size={36} strokeWidth={1.5} className="mb-3 text-ink-muted" />}
      <h3 className="font-display text-lg">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ meta, children }) {
  return <span className={`chip ${meta?.cls || 'bg-slate-100 text-slate-700'}`}>{children || meta?.label}</span>;
}

export function RiskBadge({ status }) {
  const r = RISK[status] || RISK.insufficient_data;
  return (
    <span className={`chip ${r.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.dot }} />
      {r.label}
    </span>
  );
}

export function Price({ product, size = 'md' }) {
  const deal = product?.deal;
  const main = size === 'lg' ? 'text-2xl' : 'text-base';
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-display font-bold ${main}`}>{money(product.effectivePrice ?? product.price)}</span>
      {deal && (
        <>
          <span className="text-sm text-ink-muted line-through">{money(product.price)}</span>
          <span className="text-xs font-bold text-saffron-dark">{deal.discountPercent}% off</span>
        </>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  const tones = { deal: 'border-l-saffron', risk: 'border-l-risk-dead', good: 'border-l-market', none: 'border-l-line' };
  return (
    <div className={`panel border-l-4 px-4 py-3 ${tones[tone] || tones.none}`}>
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /> Previous</button>
      <span className="text-ink-muted">Page {page} of {pages}</span>
      <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={16} /></button>
    </nav>
  );
}

export function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2>{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-paper" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${value === t.value ? 'border-market text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-paper px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const moneyOrDash = money;
