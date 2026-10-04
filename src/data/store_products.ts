export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'shirt' | 'hat' | 'hoodie';
  sizes?: string[];
  colors?: string[];
};

// Static product list — Phase 2 will pull live from Printful API.
// Snipcart reads these via data-item-* attributes; price is the source of truth
// matched against the URL on this page when the cart validates.
export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: 'tee-slush-logo-black',
    name: 'SlushFund Logo Tee',
    description: 'Classic black tee with the SlushFund mark on the chest. Soft 100% cotton.',
    price: 28,
    image: '/store/tee-slush-logo-black.png',
    category: 'shirt',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
  },
  {
    id: 'hoodie-track-the-money',
    name: '"Track the Money" Hoodie',
    description: 'Heavyweight pullover hoodie. Front print, sleeve mark.',
    price: 58,
    image: '/store/hoodie-track-the-money.png',
    category: 'hoodie',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    colors: ['Black', 'Charcoal'],
  },
  {
    id: 'hat-slush-dad',
    name: 'SlushFund Dad Hat',
    description: 'Unstructured 6-panel dad hat. Embroidered SlushFund mark.',
    price: 26,
    image: '/store/hat-slush-dad.png',
    category: 'hat',
    colors: ['Black', 'Navy', 'Khaki'],
  },
];
