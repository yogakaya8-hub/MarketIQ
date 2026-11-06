import { Link } from 'react-router-dom';
import { APP_NAME } from '../lib/constants';

export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill={light ? '#fff' : '#1B2440'} /><path d="M8 12h16l-2 11H10z" fill="#0F766E" /><path d="M12 12a4 4 0 0 1 8 0" stroke="#E8A317" strokeWidth="2.5" fill="none" /></svg>
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>{APP_NAME}</span>
    </Link>
  );
}
