import { useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import ProductCard from '../../components/ProductCard';
import { Spinner, ErrorNote } from '../../components/ui';
import { date } from '../../lib/format';

export default function StorePage() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(`/stores/${id}`);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  const { store, stats, products } = data;
  return (
    <div>
      <div className="mb-8 rounded-2xl bg-ink p-6 text-white sm:p-8">
        <h1 className="text-white">{store.storeName}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-white/70">
          {store.city && <span className="flex items-center gap-1"><MapPin size={13} />{store.city}</span>}
          <span>Selling since {date(store.createdAt)}</span>
          <span>{stats.deliveredOrders} delivered orders</span>
        </div>
        {store.description && <p className="mt-3 max-w-2xl text-white/80">{store.description}</p>}
      </div>
      <h2 className="mb-3">{stats.products} products</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p._id} product={{ ...p, store }} />)}
      </div>
    </div>
  );
}
