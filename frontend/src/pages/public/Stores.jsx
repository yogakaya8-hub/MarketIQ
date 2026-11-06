import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, PageHeader } from '../../components/ui';

export default function Stores() {
  const { data, loading, error } = useFetch('/stores');
  return (
    <div>
      <PageHeader title="Stores" subtitle="Independent sellers on the marketplace." />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.stores.map((s) => (
            <Link key={s._id} to={`/stores/${s._id}`} className="panel p-4 hover:border-ink-muted/40">
              <h2>{s.storeName}</h2>
              {s.city && <div className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted"><MapPin size={13} /> {s.city}</div>}
              <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{s.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">{s.categories.map((c) => <span key={c} className="chip bg-paper text-ink-soft">{c}</span>)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
