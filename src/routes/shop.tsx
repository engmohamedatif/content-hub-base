import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { categories, useStore } from '@/components/store/store-context';
import { PageTitle, ProductCard, StoreShell } from '@/components/store/store-ui';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { getCatalogPage, PAGE_SIZE } from '@/lib/store.functions';

const searchSchema = z.object({ q: z.string().catch(''), category: z.string().catch(''), favorites: z.boolean().catch(false), sub: z.string().optional().catch(undefined) });
export const Route = createFileRoute('/shop')({ validateSearch: input => searchSchema.parse(input), head: () => ({ meta: [{ title: 'تسوق المنتجات | برستيج زون' }, { name: 'description', content: 'تصفح فئات الشعر والبشرة والعطور والمكياج ومنتجات العناية في برستيج زون.' }, { property: 'og:title', content: 'تسوق المنتجات | برستيج زون' }, { property: 'og:description', content: 'كل منتجات العناية والجمال في مكان واحد.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Shop });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Shop() {
  const { q, category, favorites: favoritesOnly, sub } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { favorites } = useStore();
  const [selectedSub, setSelectedSub] = useState(sub ?? '');
  useEffect(() => { setSelectedSub(sub ?? ''); }, [sub, category]);
  const subcategories = categories.find(c => c.name === category)?.subs ?? [];
  const subcategory = subcategories.includes(selectedSub) ? selectedSub : '';
  const favIds = useMemo(() => favorites.filter(id => UUID.test(id)).slice(0, 100), [favorites]);
  const waitingFavorites = favoritesOnly && favIds.length === 0;
  const shopQuery = useInfiniteQuery({
    queryKey: ['shop', category, subcategory, q, favoritesOnly, favIds.join(',')],
    queryFn: ({ pageParam }) => getCatalogPage({ data: { page: pageParam, category: category || undefined, subcategory: subcategory || undefined, q: q || undefined, favorites: favoritesOnly ? favIds : undefined } }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length : undefined),
    staleTime: 60000,
    enabled: !waitingFavorites,
  });
  const products = shopQuery.data?.pages.flatMap(page => page.items) ?? [];
  const total = shopQuery.data?.pages[0]?.total ?? 0;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !shopQuery.hasNextPage) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !shopQuery.isFetchingNextPage) shopQuery.fetchNextPage();
    }, { rootMargin: '400px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [shopQuery.hasNextPage, shopQuery.isFetchingNextPage, shopQuery.fetchNextPage]);
  return <StoreShell><main className="mx-auto min-h-[55vh] max-w-7xl px-6 py-12"><PageTitle eyebrow="برستيج زون" title={favoritesOnly ? 'المفضلة' : category || 'كل المنتجات'} detail={q ? `نتائج البحث عن «${q}»` : ''} /><div className="mb-5 flex gap-2 overflow-x-auto pb-2"><Button variant={!category && !favoritesOnly ? 'default' : 'outline'} size="sm" onClick={() => {setSelectedSub('');navigate({ search: { q, category: '', favorites: false } });}}>الكل</Button>{categories.map(c => <Button key={c.name} variant={category === c.name ? 'default' : 'outline'} size="sm" className="shrink-0" onClick={() => {setSelectedSub('');navigate({ search: { q, category: c.name, favorites: false } });}}>{c.name}</Button>)}</div>{subcategories.length > 0 && <div className="mb-8 flex flex-wrap gap-2"><Button size="sm" variant={!subcategory ? 'secondary' : 'ghost'} onClick={() => setSelectedSub('')}>كل الأنواع</Button>{subcategories.map(sub => <Button key={sub} size="sm" variant={subcategory === sub ? 'secondary' : 'ghost'} onClick={() => setSelectedSub(sub)}>{sub}</Button>)}</div>}
    {!waitingFavorites && total > 0 && <p className="mb-4 text-sm text-muted-foreground">{total.toLocaleString('ar-EG')} منتج</p>}
    {waitingFavorites || shopQuery.isPending ? <p className="py-16 text-center text-muted-foreground">{waitingFavorites ? '' : 'جاري تحميل المنتجات...'}</p>
      : products.length ? <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">{products.map(p => <ProductCard key={p.id} product={p} />)}
          {shopQuery.hasNextPage && <div ref={sentinel} className="col-span-full flex justify-center py-4"><Button variant="outline" disabled={shopQuery.isFetchingNextPage} onClick={() => shopQuery.fetchNextPage()}>{shopQuery.isFetchingNextPage ? 'جاري تحميل المزيد...' : 'عرض المزيد'}</Button></div>}
        </div>
      </>
      : <div className="grid min-h-56 place-content-center gap-3 text-center text-muted-foreground"><Heart className="mx-auto size-8" /><p>{favoritesOnly ? 'لم تضف منتجات للمفضلة بعد' : 'لا توجد منتجات في هذا القسم حالياً'}</p></div>}
  </main></StoreShell>;
}
