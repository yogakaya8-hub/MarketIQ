import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Spinner, ErrorNote, Empty, PageHeader, Badge, Tabs, Pagination } from '../../components/ui';
import { ORDER_STATUS } from '../../lib/constants';
import { money, dateTime } from '../../lib/format';

export default function VendorOrders({ admin = false }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, loading, error } = useFetch(admin ? '/orders' : '/orders/vendor', { params: { page, ...(status ? { status } : {}), ...(q ? { q } : {}) } });
  const base = admin ? '/admin/orders' : '/vendor/orders';
  return (
    <div>
      <PageHeader title={admin ? 'All orders' : 'Orders'} subtitle={admin ? 'Every order across the marketplace.' : 'Confirm, ship and deliver your orders.'} />
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: '', label: 'All' }, ...Object.entries(ORDER_STATUS).map(([v, m]) => ({ value: v, label: m.label }))]} />
      <input className="input mb-4 max-w-xs" placeholder="Search order number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search order number" />
      <ErrorNote message={error} />
      {loading ? <Spinner /> : data?.orders.length === 0 ? <Empty icon={ShoppingBag} title="No orders here" /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="table min-w-[720px]">
              <thead><tr><th>Order</th>{admin && <th>Store</th>}<th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o._id}>
                    <td><Link to={`${base}/${o._id}`} className="link">{o.orderNumber}</Link>{o.source === 'requirement' && <div className="text-xs text-indigo-700">From requirement</div>}</td>
                    {admin && <td>{o.store?.storeName}</td>}
                    <td>{o.customer?.name}<div className="text-xs text-ink-muted">{o.shippingAddress.city}</div></td>
                    <td className="max-w-[260px] text-ink-soft">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</td>
                    <td className="font-semibold">{money(o.totalAmount)}</td>
                    <td><Badge meta={ORDER_STATUS[o.status]} /></td>
                    <td className="text-ink-muted">{dateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
