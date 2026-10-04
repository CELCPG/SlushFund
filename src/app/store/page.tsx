import type { Metadata } from 'next';
import { STORE_PRODUCTS } from '@/data/store_products';
import { ShoppingBag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Store. SlushFund',
  description: 'SlushFund merch. Shirts, hats, and hoodies. Fulfilled by Printful, checkout via Snipcart.',
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://slushfund.net';

export default function StorePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-14">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <ShoppingBag className="text-emerald-400" size={28} />
          <h1 className="text-4xl font-black text-white">SlushFund Store</h1>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {STORE_PRODUCTS.map((p) => (
          <article
            key={p.id}
            className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col"
          >
            <div className="aspect-square bg-slate-950 flex items-center justify-center text-slate-700 text-sm">
              {/* Placeholder until product images are added under /public/store */}
              <span>Product image</span>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-white font-bold text-lg mb-1">{p.name}</h3>
              <p className="text-slate-400 text-sm mb-3 flex-1">{p.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-mono font-bold">${p.price.toFixed(2)}</span>
                <button
                  type="button"
                  className="snipcart-add-item inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                  data-item-id={p.id}
                  data-item-name={p.name}
                  data-item-price={p.price}
                  data-item-url={`${SITE_URL}/store`}
                  data-item-description={p.description}
                  data-item-image={p.image}
                  {...(p.sizes
                    ? {
                        'data-item-custom1-name': 'Size',
                        'data-item-custom1-options': p.sizes.join('|'),
                      }
                    : {})}
                  {...(p.colors
                    ? {
                        'data-item-custom2-name': 'Color',
                        'data-item-custom2-options': p.colors.join('|'),
                      }
                    : {})}
                >
                  <ShoppingBag size={14} /> Add to cart
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-slate-500 text-xs">
        Checkout powered by Snipcart. Fulfilled by Printful. Shipping calculated at checkout.
      </p>
    </div>
  );
}
