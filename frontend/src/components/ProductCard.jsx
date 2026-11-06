import { Link } from 'react-router-dom';
import ProductArt from './ProductArt';
import { Price } from './ui';
import { timeLeft } from '../lib/format';

export default function ProductCard({ product }) {
  const out = product.stock <= 0;
  return (
    <Link to={`/products/${product._id}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white hover:border-ink-muted/40">
      <div className="relative aspect-[4/3]">
        <ProductArt product={product} size={48} />
        {product.deal && (
          <span className="absolute left-0 top-3 rounded-r-full bg-saffron px-3 py-1 text-xs font-bold text-ink">
            Rescue deal, {timeLeft(product.deal.endsAt)}
          </span>
        )}
        {out && <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-xs font-semibold text-white">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-xs text-ink-muted">{product.store?.storeName}</span>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">{product.name}</h3>
        <div className="mt-auto pt-1"><Price product={product} /></div>
      </div>
    </Link>
  );
}
