import { Field } from './ui';

export const emptyAddress = { line1: '', city: '', state: '', postalCode: '' };

export default function AddressForm({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Address"><input className="input" required minLength={3} value={value.line1} onChange={set('line1')} placeholder="House number, street, area" /></Field></div>
      <Field label="City"><input className="input" required value={value.city} onChange={set('city')} /></Field>
      <Field label="State"><input className="input" value={value.state} onChange={set('state')} /></Field>
      <Field label="PIN code"><input className="input" required pattern="[A-Za-z0-9 \-]{3,12}" value={value.postalCode} onChange={set('postalCode')} /></Field>
    </div>
  );
}
