import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Truck, BadgePercent, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import hero from '@/assets/beauty-hero.jpg';
import baby from '@/assets/category-baby.jpg';
import paper from '@/assets/category-paper.jpg';
import { useStore } from '@/components/store/store-context';
import { CategoryStrip, PageTitle, ProductCard, StoreShell } from '@/components/store/store-ui';

export const Route = createFileRoute('/')({ head: () => ({ meta: [{ title: 'برستيج زون | كل احتياجات البيت والعناية' }, { name: 'description', content: 'تسوق منتجات العناية والطفل والبيت من برستيج زون بأسعار مناسبة والدفع عند الاستلام.' }, { property: 'og:title', content: 'برستيج زون | كل احتياجات البيت والعناية' }, { property: 'og:description', content: 'منتجات العناية والطفل والبيت بأسعار مناسبة من برستيج زون.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Home });

const shopAll = { q: '', category: '', favorites: false };

function Home() {
  const { products, session, authReady } = useStore();
  const deals = products.filter(p => p.discount_amount > 0);
  const showIntro = authReady && !session;
  return <StoreShell><main className="mx-auto max-w-7xl px-3 sm:px-4">
    {showIntro && <>
      <section className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="store-reveal relative overflow-hidden rounded-3xl bg-accent lg:col-span-2">
          <img src={hero} alt="منتجات عناية وطفل وبيت" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover object-left" />
          <div className="absolute inset-0 bg-[linear-gradient(270deg,var(--accent)_30%,transparent_75%)]" />
          <div className="relative flex min-h-[300px] max-w-md flex-col justify-center p-6 sm:min-h-[380px] sm:p-10">
            <span className="mb-3 w-fit rounded-full bg-sale px-3 py-1 text-xs font-extrabold text-sale-foreground">عروض كل يوم</span>
            <h1 className="text-3xl font-extrabold leading-tight text-primary sm:text-5xl">كل اللي بيتك محتاجه في مكان واحد</h1>
            <p className="mt-3 text-sm leading-7 text-foreground/80 sm:text-base">شعر، بشرة، طفل، ورقيات ومنظفات — بأسعار مناسبة وتوصيل لحد بابك.</p>
            <Button size="lg" className="mt-6 w-fit gap-2 rounded-full px-7 font-bold" asChild><Link to="/shop" search={shopAll}>اطلب دلوقتي <ArrowLeft className="size-4" /></Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Promo img={baby} title="كل حاجة للطفل" sub="حفاضات وببرونات وشامبو" cat="عناية بالطفل" />
          <Promo img={paper} title="ورقيات البيت" sub="مناديل وفوط وحفاضات" cat="ورقيات" />
        </div>
      </section>
      <section className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-3 text-center text-xs font-bold sm:text-sm">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center"><Truck className="size-5 text-primary" />توصيل لحد البيت</div>
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center"><Banknote className="size-5 text-primary" />ادفع عند الاستلام</div>
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center"><BadgePercent className="size-5 text-primary" />أسعار مناسبة</div>
      </section>
    </>}
    <section className="mt-8"><h2 className="mb-4 text-xl font-extrabold sm:text-2xl">تسوق حسب القسم</h2><CategoryStrip /></section>
    {deals.length > 0 && <section className="mt-10 rounded-3xl bg-sale/25 p-4 sm:p-6"><Header title="🔥 عروض وخصومات" /><Grid items={deals.slice(0, 8)} /></section>}
    <section className="mt-10"><Header title={session ? 'كل المنتجات' : 'منتجاتنا'} />{products.length ? <Grid items={session ? products : products.slice(0, 12)} /> : <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">قريباً: منتجات جديدة تناسب كل احتياجاتك</div>}</section>
  </main></StoreShell>;
}
function Header({ title }: { title: string }) { return <div className="flex items-end justify-between gap-4"><PageTitle title={title} /><Link to="/shop" search={shopAll} className="mb-6 flex shrink-0 items-center gap-1 text-sm font-bold text-primary">عرض الكل <ArrowLeft className="size-4" /></Link></div>; }
function Grid({ items }: { items: ReturnType<typeof useStore>['products'] }) { return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{items.map(p => <ProductCard key={p.id} product={p} />)}</div>; }
function Promo({ img, title, sub, cat }: { img: string; title: string; sub: string; cat: string }) {
  return <Link to="/shop" search={{ ...shopAll, category: cat }} className="store-reveal group relative flex min-h-[140px] overflow-hidden rounded-3xl bg-secondary sm:min-h-[184px]"><img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/20 to-transparent" /><div className="relative mt-auto p-4 text-primary-foreground"><b className="block text-base sm:text-lg">{title}</b><span className="text-xs opacity-85">{sub}</span></div></Link>;
}
