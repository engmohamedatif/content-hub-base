import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useMemo, useEffect, useState } from 'react';
import { categories, useStore } from '@/components/store/store-context';
import { PageTitle, ProductCard, StoreShell } from '@/components/store/store-ui';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
const searchSchema = z.object({ q: z.string().catch(''), category: z.string().catch(''), favorites: z.boolean().catch(false), sub: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/shop')({ validateSearch: input => searchSchema.parse(input), head: () => ({ meta: [{ title: 'تسوق المنتجات | برستيج زون' }, { name: 'description', content: 'تصفح فئات الشعر والبشرة والعطور والمكياج ومنتجات العناية في برستيج زون.' }, { property: 'og:title', content: 'تسوق المنتجات | برستيج زون' }, { property: 'og:description', content: 'كل منتجات العناية والجمال في مكان واحد.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Shop });
function Shop() {
  const { q, category, favorites: favoritesOnly, sub } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { products, favorites, loading } = useStore();
  const [selectedSub, setSelectedSub] = useState(sub ?? '');
  useEffect(() => { setSelectedSub(sub ?? ''); }, [sub, category]);
  const subcategories = categories.find(c => c.name === category)?.subs ?? [];
  const subcategory = subcategories.includes(selectedSub) ? selectedSub : '';
  const visible = useMemo(() => products.filter(p => (!category || p.category === category) && (!subcategory || p.subcategory === subcategory) && (!q || `${p.name} ${p.category} ${p.subcategory ?? ''}`.includes(q)) && (!favoritesOnly || favorites.includes(p.id))), [products, category, subcategory, q, favoritesOnly, favorites]);
  return <StoreShell><main className="mx-auto min-h-[55vh] max-w-7xl px-6 py-12"><PageTitle eyebrow="برستيج زون" title={favoritesOnly ? 'المفضلة' : category || 'كل المنتجات'} detail={q ? `نتائج البحث عن «${q}»` : ''} /><div className="mb-5 flex gap-2 overflow-x-auto pb-2"><Button variant={!category && !favoritesOnly ? 'default' : 'outline'} size="sm" onClick={() => {setSelectedSub('');navigate({ search: { q, category: '', favorites: false } });}}>الكل</Button>{categories.map(c => <Button key={c.name} variant={category === c.name ? 'default' : 'outline'} size="sm" className="shrink-0" onClick={() => {setSelectedSub('');navigate({ search: { q, category: c.name, favorites: false } });}}>{c.name}</Button>)}</div>{subcategories.length > 0 && <div className="mb-8 flex flex-wrap gap-2"><Button size="sm" variant={!subcategory ? 'secondary' : 'ghost'} onClick={() => setSelectedSub('')}>كل الأنواع</Button>{subcategories.map(sub => <Button key={sub} size="sm" variant={subcategory === sub ? 'secondary' : 'ghost'} onClick={() => setSelectedSub(sub)}>{sub}</Button>)}</div>}{loading ? <p className="py-16 text-center text-muted-foreground">جاري تحميل المنتجات...</p> : visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">{visible.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="grid min-h-56 place-content-center gap-3 text-center text-muted-foreground"><Heart className="mx-auto size-8" /><p>{favoritesOnly ? 'لم تضف منتجات للمفضلة بعد' : 'لا توجد منتجات في هذا القسم حالياً'}</p></div>}</main></StoreShell>;
}
