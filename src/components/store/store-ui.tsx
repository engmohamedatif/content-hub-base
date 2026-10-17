import { Link, useNavigate } from '@tanstack/react-router';
import { Heart, ShoppingCart, Search, UserRound, ArrowLeft, PackageOpen, Plus, Home, LayoutGrid, Phone, Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CustomerChat } from './CustomerChat';
import logoUrl from '@/assets/prestige-zone-logo.jpg';
import hair from '@/assets/category-hair.jpg';
import body from '@/assets/category-body.jpg';
import beauty from '@/assets/category-beauty.jpg';
import baby from '@/assets/category-baby.jpg';
import removal from '@/assets/category-removal.jpg';
import oral from '@/assets/category-oral.jpg';
import perfume from '@/assets/category-perfume.jpg';
import paper from '@/assets/category-paper.jpg';
import spray from '@/assets/category-spray.jpg';
import insect from '@/assets/category-insect.jpg';
import air from '@/assets/category-air.jpg';
import devices from '@/assets/category-devices.jpg';
import { categories, discountOf, money, priceOf, useStore, type Product } from './store-context';

export const categoryImages: Record<string, string> = { 'عناية بالشعر': hair, 'عناية بالجسم': body, 'عناية بالطفل': baby, 'ميك أب': beauty, 'برفانات': perfume, 'سبريهات': spray, 'مزيلات شعر': removal, 'عناية بالفم': oral, 'ورقيات': paper, 'مبيدات حشرية': insect, 'معطرات جو': air, 'متنوعات': devices };
const shopAll = { q: '', category: '', favorites: false };

export function CategoryStrip() {
  return <div className="flex gap-4 overflow-x-auto pb-2 sm:gap-6 [scrollbar-width:none]">{categories.map(c => <Link key={c.name} to="/shop" search={{ q: '', category: c.name, favorites: false }} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24"><span className="size-20 overflow-hidden rounded-full border-4 border-card bg-secondary shadow-sm ring-2 ring-accent transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-brand-gold sm:size-24"><img src={categoryImages[c.name]} alt="" loading="lazy" className="h-full w-full object-cover" /></span><span className="text-xs font-bold leading-4 sm:text-sm">{c.name}</span></Link>)}</div>;
}

export function StoreShell({ children }: { children: ReactNode }) {
  const { cart, favorites, session } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate({ to: '/shop', search: { ...shopAll, q: search } }); };
  return <div className="min-h-screen bg-background pb-20 text-foreground md:pb-0" dir="rtl">
    <div className="bg-sale px-4 py-1.5 text-center text-xs font-bold text-sale-foreground sm:text-sm">🎉 أسعار في متناول الجميع — والدفع عند الاستلام متاح</div>
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-4 lg:gap-6">
        <Sheet><SheetTrigger asChild><button type="button" aria-label="قائمة الأقسام" className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary md:hidden"><Menu className="size-5" /></button></SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto p-0" dir="rtl"><SheetTitle className="bg-primary py-4 pr-5 pl-12 text-lg font-extrabold text-primary-foreground">كل الأقسام</SheetTitle>
            <div className="grid gap-1 p-3"><Link to="/shop" search={shopAll} className="rounded-xl bg-secondary px-4 py-3 font-bold text-primary">كل المنتجات</Link>{categories.map(c => <details key={c.name} className="group rounded-xl"><summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 font-bold hover:bg-secondary">{c.name}{c.subs.length > 0 && <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>}</summary><div className="grid gap-1 pr-6 pb-2 text-sm"><Link to="/shop" search={{ ...shopAll, category: c.name }} className="py-1.5 text-primary">كل {c.name}</Link>{c.subs.map(sub => <Link key={sub} to="/shop" search={{ ...shopAll, category: c.name, sub }} className="py-1.5 text-muted-foreground hover:text-primary">{sub}</Link>)}</div></details>)}</div>
          </SheetContent></Sheet>
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="برستيج زون - الرئيسية"><img src={logoUrl} alt="برستيج زون" className="size-11 rounded-xl object-cover sm:size-12" /><span className="hidden text-lg font-extrabold text-primary sm:block">برستيج زون</span></Link>
        <form className="flex min-w-0 flex-1 items-center rounded-full border-2 border-primary/15 bg-secondary focus-within:border-primary" onSubmit={submit}><Search className="mr-3 size-4 shrink-0 text-muted-foreground" /><input className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder="بتدور على إيه؟" value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit" size="sm" className="m-1 hidden rounded-full px-5 sm:inline-flex">ابحث</Button></form>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <Link to="/shop" search={{ ...shopAll, favorites: true }} className="relative flex flex-col items-center rounded-xl px-3 py-1 text-xs hover:bg-secondary"><Heart className="size-5" />المفضلة{favorites.length > 0 && <Badge n={favorites.length} />}</Link>
          <Link to={session ? '/account' : '/auth'} className="flex flex-col items-center rounded-xl px-3 py-1 text-xs hover:bg-secondary"><UserRound className="size-5" />حسابي</Link>
          <Link to="/cart" className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"><ShoppingCart className="size-5" />السلة{count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-sale px-1 text-xs text-sale-foreground">{count}</span>}</Link>
        </div>
      </div>
      <nav className="border-t border-border"><div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-3 py-2 text-sm [scrollbar-width:none] sm:px-4"><Link to="/shop" search={shopAll} className="shrink-0 rounded-full bg-primary px-4 py-1.5 font-bold text-primary-foreground">كل المنتجات</Link>{categories.map(c => <Link key={c.name} to="/shop" search={{ ...shopAll, category: c.name }} className="shrink-0 rounded-full bg-secondary px-4 py-1.5 hover:bg-accent">{c.name}</Link>)}</div></nav>
    </header>
    {children}
    <CustomerChat />
    <footer className="mt-16 bg-primary text-primary-foreground"><div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 md:grid-cols-3"><div className="flex items-start gap-3"><img src={logoUrl} alt="" className="size-14 rounded-xl object-cover" /><div><h3 className="text-lg font-bold">برستيج زون</h3><p className="mt-1 text-sm text-primary-foreground/75">كل احتياجات البيت والعناية بأسعار مناسبة.</p></div></div><div><h4 className="mb-3 font-bold">تسوق</h4><div className="grid gap-2 text-sm text-primary-foreground/75"><Link to="/shop" search={shopAll}>كل المنتجات</Link><Link to="/cart">سلة التسوق</Link></div></div><div><h4 className="mb-3 font-bold">كلمنا</h4><a href="tel:01041610065" dir="ltr" className="inline-flex items-center gap-2 text-lg font-bold"><Phone className="size-4" />01041610065</a><p className="mt-2 text-sm text-primary-foreground/75">كاش عند الاستلام • إنستا باي • فودافون كاش</p></div></div><div className="border-t border-primary-foreground/15 py-4 text-center text-xs text-primary-foreground/60">© برستيج زون</div></footer>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card text-[11px] md:hidden">
      <Link to="/" className="flex flex-col items-center gap-0.5 py-2" activeOptions={{ exact: true }} activeProps={{ className: 'text-primary font-bold' }}><Home className="size-5" />الرئيسية</Link>
      <Link to="/shop" search={shopAll} className="flex flex-col items-center gap-0.5 py-2"><LayoutGrid className="size-5" />الأقسام</Link>
      <Link to="/cart" className="relative flex flex-col items-center gap-0.5 py-2" activeProps={{ className: 'text-primary font-bold' }}><ShoppingCart className="size-5" />السلة{count > 0 && <span className="absolute top-1 left-1/2 -translate-x-4 grid min-w-4 place-items-center rounded-full bg-sale px-1 text-[10px] font-bold text-sale-foreground">{count}</span>}</Link>
      <Link to={session ? '/account' : '/auth'} className="flex flex-col items-center gap-0.5 py-2"><UserRound className="size-5" />حسابي</Link>
    </nav>
  </div>;
}
function Badge({ n }: { n: number }) { return <span className="absolute top-0 left-1 grid min-w-4 place-items-center rounded-full bg-brand-gold px-1 text-[10px] text-primary-foreground">{n}</span>; }

export function ProductCard({ product }: { product: Product }) {
  const { favorites, toggleFavorite, addToCart } = useStore();
  const discounted = discountOf(product);
  const fav = favorites.includes(product.id);
  return <article className="store-reveal group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg">
    <div className="relative aspect-square overflow-hidden bg-secondary"><Link to="/product/$id" params={{ id: product.id }} className="block h-full">{product.image_urls[0] ? <img src={product.image_urls[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center"><PackageOpen className="size-12 text-muted-foreground/40" /></div>}</Link>
      {discounted > 0 && <span className="absolute top-2 right-2 rounded-full bg-sale px-2.5 py-1 text-xs font-extrabold text-sale-foreground">-{discounted}٪</span>}
      <button type="button" className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-card shadow" aria-label={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} onClick={() => toggleFavorite(product.id)}><Heart className={`size-4 ${fav ? 'fill-brand-gold text-brand-gold' : ''}`} /></button>
    </div>
    <div className="flex flex-1 flex-col gap-1.5 p-3">
      <Link to="/product/$id" params={{ id: product.id }} className="line-clamp-2 min-h-10 text-sm font-bold leading-5 hover:text-primary">{product.name}</Link>
      <p className="line-clamp-1 text-xs text-muted-foreground">{product.card_description || product.category}</p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <div className="min-w-0"><strong className="block text-lg font-extrabold leading-6 text-primary">{money(priceOf(product))}</strong>{discounted > 0 && <del className="text-xs text-muted-foreground">{money(product.price)}</del>}</div>
        <Button size="icon" className="size-10 shrink-0 rounded-full" disabled={product.stock === 0} aria-label={product.stock ? 'أضف للسلة' : 'نفدت الكمية'} onClick={() => addToCart(product.id)}><Plus className="size-5" /></Button>
      </div>
      {product.stock === 0 && <span className="text-xs font-bold text-destructive">نفدت الكمية</span>}
    </div>
  </article>;
}
export function PageTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) { return <div className="mb-6"><p className="mb-1 text-xs font-bold text-brand-gold">{eyebrow}</p><h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>{detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}</div>; }
export function BackShop() { return <Link to="/shop" search={shopAll} className="inline-flex items-center gap-2 text-sm text-primary hover:text-brand-gold">متابعة التسوق <ArrowLeft className="size-4" /></Link>; }
