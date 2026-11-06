import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useState } from 'react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader, Badge, Pagination } from '../../components/ui';
import { ORDER_STATUS } from '../../lib/constants';
import { money, date } from '../../lib/format';

export default function MyOrders() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch('/orders/my', { params: { page } });
  return (
    <div>
      <PageHeader title="Your orders" />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data?.orders.length === 0 ? (
        <Empty icon={Package} title="No orders yet" action={<Link to="/products" className="btn-primary">Start shopping</Link>} />
      ) : (
        <>
          <ul className="space-y-3">
            {data?.orders.map((o) => (
              <li key={o._id}>
                <Link to={`/orders/${o._id}`} className="panel flex flex-col gap-2 p-4 hover:border-ink-muted/40 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.orderNumber}</span>
                      <Badge meta={ORDER_STATUS[o.status]} />
                      {o.source === 'requirement' && <span className="chip bg-indigo-50 text-indigo-800">From your requirement</span>}
                    </div>
                    <div className="text-sm text-ink-muted">{o.store?.storeName}, placed {date(o.createdAt)}</div>
                    <div className="mt-1 text-sm text-ink-soft">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</div>
                  </div>
                  <div className="font-display text-lg font-bold">{money(o.totalAmount)}</div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
