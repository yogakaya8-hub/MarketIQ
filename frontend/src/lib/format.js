const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const money = (n) => (n == null ? '–' : Number.isInteger(n) ? inr.format(n) : inr2.format(n));
export const number = (n) => (n == null ? '–' : new Intl.NumberFormat('en-IN').format(n));
export const pct = (n) => (n == null ? '–' : `${n}%`);

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '–');

export function relative(d) {
  if (!d) return '–';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [[60, 'second', 1], [3600, 'minute', 60], [86400, 'hour', 3600], [2592000, 'day', 86400], [31536000, 'month', 2592000], [Infinity, 'year', 31536000]];
  for (const [limit, unit, div] of units) if (abs < limit) return fmt.format(-Math.round(diff / div), unit);
  return date(d);
}

export function timeLeft(d) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

export const todayPlus = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
