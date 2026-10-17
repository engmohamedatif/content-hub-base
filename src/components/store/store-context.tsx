import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ShoppingBag } from 'lucide-react';
import { getCatalog } from '@/lib/store.functions';
import { supabase } from '@/integrations/supabase/client';

type Product = Awaited<ReturnType<typeof getCatalog>>[number];
type CartLine = { id: string; quantity: number };
type StoreContextValue = { products: Product[]; loading: boolean; cart: CartLine[]; favorites: string[]; addToCart: (id: string, quantity?: number) => void; setQuantity: (id: string, quantity: number) => void; toggleFavorite: (id: string) => void; clearCart: () => void; session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']; authReady: boolean };
const StoreContext = createContext<StoreContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const { data: products = [], isPending: loading } = useQuery({ queryKey: ['catalog'], queryFn: () => getCatalog(), staleTime: 60000 });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [session, setSession] = useState<StoreContextValue['session']>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{ name: string; count: number } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
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
  const addToCart = (id: string, quantity = 1) => {
    const product = products.find(p => p.id === id);
    if (!product || product.stock < 1 || quantity < 1) return;
    const current = cart.find(line => line.id === id)?.quantity ?? 0;
    const count = Math.max(0, Math.min(product.stock - current, quantity));
    if (!count) return;
    setCart(previous => {
      const existing = previous.find(line => line.id === id);
      return existing ? previous.map(line => line.id === id ? { ...line, quantity: Math.min(product.stock, line.quantity + quantity) } : line) : [...previous, { id, quantity: Math.min(product.stock, quantity) }];
    });
    setCartFeedback({ name: product.name, count });
  };
  const setQuantity = (id: string, quantity: number) => setCart(previous => quantity <= 0 ? previous.filter(line => line.id !== id) : previous.map(line => line.id === id ? { ...line, quantity: Math.min(products.find(p => p.id === id)?.stock ?? quantity, quantity) } : line));
  const toggleFavorite = (id: string) => setFavorites(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  return <StoreContext.Provider value={{ products, loading, cart, favorites, addToCart, setQuantity, toggleFavorite, clearCart: () => setCart([]), session, authReady }}>{children}{cartFeedback && <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center px-5" role="status" aria-live="polite"><div key={`${cartFeedback.name}-${cartFeedback.count}`} className="cart-confirmation pointer-events-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-md border border-brand-gold bg-primary p-7 text-center text-primary-foreground shadow-xl"><span className="grid size-14 place-items-center rounded-full bg-brand-gold text-primary"><Check className="size-8" /></span><strong className="text-lg">اتضاف للسلة!</strong><p className="line-clamp-2 text-sm text-primary-foreground/80">{cartFeedback.name} × {cartFeedback.count}</p><ShoppingBag className="size-5 text-brand-gold" /></div></div>}</StoreContext.Provider>;
}
export function useStore() { const value = useContext(StoreContext); if (!value) throw new Error('Store context missing'); return value; }
export type { Product };
export function priceOf(p: Product) { return p.discount_until && new Date(p.discount_until).getTime() > Date.now() ? Math.max(0, p.price - p.discount_amount) : p.price; }
export function discountOf(p: Product) { return p.price > 0 ? Math.round((1 - priceOf(p) / p.price) * 100) : 0; }
export const money = (amount: number) => `${Number(amount).toLocaleString('ar-EG')} ج.م`;
export { categories } from '@/lib/catalog-categories';
