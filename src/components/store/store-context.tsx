import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ShoppingBag } from 'lucide-react';
import { getProductsByIds } from '@/lib/store.functions';
import { supabase } from '@/integrations/supabase/client';

type Product = Awaited<ReturnType<typeof getProductsByIds>>[number];
type CartLine = { id: string; quantity: number };
type StoreContextValue = { cartProducts: Product[]; cartLoading: boolean; cart: CartLine[]; favorites: string[]; addToCart: (id: string, quantity?: number, product?: Product) => void; setQuantity: (id: string, quantity: number) => void; toggleFavorite: (id: string) => void; clearCart: () => void; session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']; authReady: boolean };
// Keep one context instance across hot reloads so provider and consumers never diverge.
const g = globalThis as { __prestigeStoreContext?: React.Context<StoreContextValue | null> };
const StoreContext = g.__prestigeStoreContext ??= createContext<StoreContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [session, setSession] = useState<StoreContextValue['session']>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{ name: string; count: number } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const cartIds = useMemo(() => cart.map(line => line.id), [cart]);
  // Only the products actually referenced by the cart are fetched — never the whole catalog.
  const { data: cartProducts = [], isPending: cartLoading } = useQuery({
    queryKey: ['cart-products', cartIds.slice().sort().join(',')],
    queryFn: () => getProductsByIds({ data: { ids: cartIds } }),
    enabled: cartIds.length > 0,
    staleTime: 60000,
  });
  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem('prestige-cart') ?? '[]')); setFavorites(JSON.parse(localStorage.getItem('prestige-favorites') ?? '[]')); } catch { /* ignore stale storage */ }
    setStorageReady(true);
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); }).catch(() => setAuthReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setAuthReady(true); });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (storageReady) localStorage.setItem('prestige-cart', JSON.stringify(cart)); }, [cart, storageReady]);
  useEffect(() => { if (storageReady) localStorage.setItem('prestige-favorites', JSON.stringify(favorites)); }, [favorites, storageReady]);
  useEffect(() => { if (!cartFeedback) return; const timer = window.setTimeout(() => setCartFeedback(null), 2200); return () => window.clearTimeout(timer); }, [cartFeedback]);
  const addToCart = (id: string, quantity = 1, product?: Product) => {
    const info = product ?? cartProducts.find(p => p.id === id);
    if (quantity < 1 || (info && (info.stock < 1))) return;
    setCart(previous => {
      const existing = previous.find(line => line.id === id);
      const stock = info ? info.stock : quantity;
      return existing ? previous.map(line => line.id === id ? { ...line, quantity: Math.min(stock, line.quantity + quantity) } : line) : [...previous, { id, quantity: Math.min(stock, quantity) }];
    });
    setCartFeedback({ name: info?.name ?? 'المنتج', count: quantity });
  };
  const setQuantity = (id: string, quantity: number) => setCart(previous => {
    if (quantity <= 0) return previous.filter(line => line.id !== id);
    const stock = cartProducts.find(p => p.id === id)?.stock ?? quantity;
    return previous.map(line => line.id === id ? { ...line, quantity: Math.min(stock, quantity) } : line);
  });
  const toggleFavorite = (id: string) => setFavorites(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  return <StoreContext.Provider value={{ cartProducts, cartLoading, cart, favorites, addToCart, setQuantity, toggleFavorite, clearCart: () => setCart([]), session, authReady }}>{children}{cartFeedback && <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center px-5" role="status" aria-live="polite"><div key={`${cartFeedback.name}-${cartFeedback.count}`} className="cart-confirmation pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-md border border-brand-gold bg-primary p-7 text-center text-primary-foreground shadow-xl"><span className="grid size-14 place-items-center rounded-full bg-brand-gold text-primary"><Check className="size-8" /></span><strong className="text-lg">اتضاف للسلة!</strong><p className="line-clamp-2 text-sm text-primary-foreground/80">{cartFeedback.name} × {cartFeedback.count}</p><ShoppingBag className="size-5 text-brand-gold" /></div></div>}</StoreContext.Provider>;
}
export function useStore() { const value = useContext(StoreContext); if (!value) throw new Error('Store context missing'); return value; }
export type { Product };
export function priceOf(p: Product) { return p.discount_until && new Date(p.discount_until).getTime() > Date.now() ? Math.max(0, p.price - p.discount_amount) : p.price; }
export function discountOf(p: Product) { return p.price > 0 ? Math.round((1 - priceOf(p) / p.price) * 100) : 0; }
export const money = (amount: number) => `${Number(amount).toLocaleString('ar-EG')} ج.م`;
export { categories } from '@/lib/catalog-categories';
