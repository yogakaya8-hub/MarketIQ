import { useState } from 'react';
import { Headphones, Shirt, CookingPot, BookOpen, Dumbbell, Sparkles, ShoppingBasket, Puzzle, NotebookPen, HeartPulse, Package } from 'lucide-react';

// Generated artwork per category, used when a vendor has not provided an image URL.
const ART = {
  Electronics: { Icon: Headphones, bg: '#DCE6F7', fg: '#1E3A8A' },
  Fashion: { Icon: Shirt, bg: '#F6E1E7', fg: '#9D174D' },
  'Home & Kitchen': { Icon: CookingPot, bg: '#F3E8D8', fg: '#92400E' },
  Books: { Icon: BookOpen, bg: '#E7E3F5', fg: '#4C1D95' },
  'Sports & Fitness': { Icon: Dumbbell, bg: '#DDF1E8', fg: '#065F46' },
  'Beauty & Personal Care': { Icon: Sparkles, bg: '#F8E5DE', fg: '#9A3412' },
  Groceries: { Icon: ShoppingBasket, bg: '#EAF2D6', fg: '#3F6212' },
  'Toys & Games': { Icon: Puzzle, bg: '#FBEFC9', fg: '#854D0E' },
  'Office Supplies': { Icon: NotebookPen, bg: '#E2E8F0', fg: '#334155' },
  Health: { Icon: HeartPulse, bg: '#FBE3E3', fg: '#991B1B' },
};

export default function ProductArt({ product, className = '', size = 56 }) {
  const [broken, setBroken] = useState(false);
  const art = ART[product?.category] || { Icon: Package, bg: '#E3E6EF', fg: '#3A4566' };
  if (product?.imageUrl && !broken) {
    return <img src={product.imageUrl} alt={product.name} onError={() => setBroken(true)} className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const { Icon } = art;
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`} style={{ backgroundColor: art.bg }} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`p-${art.fg.slice(1)}`} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="18" stroke={art.fg} strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#p-${art.fg.slice(1)})`} />
      </svg>
      <Icon size={size} strokeWidth={1.4} color={art.fg} className="relative" />
    </div>
  );
}
