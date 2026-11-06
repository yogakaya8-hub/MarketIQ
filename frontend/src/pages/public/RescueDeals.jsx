import { BadgePercent } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import ProductCard from '../../components/ProductCard';
import { Spinner, ErrorNote, Empty, PageHeader } from '../../components/ui';

export default function RescueDeals() {
  const { data, loading, error, reload } = useFetch('/rescue-deals');
  return (
    <div>
      <PageHeader
        title="Rescue deals"
        subtitle="Sellers are clearing stock that has not been selling, at reduced prices for a limited time. Prices return to normal when a deal ends."
      />
      <ErrorNote message={error} onRetry={reload} />
      {loading ? <Spinner /> : data?.deals.length === 0 ? (
        <Empty icon={BadgePercent} title="No rescue deals right now">Check back soon. Deals appear when sellers discount slow-moving stock.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data?.deals.map((d) => <ProductCard key={d._id} product={d.product} />)}
        </div>
      )}
    </div>
  );
}
