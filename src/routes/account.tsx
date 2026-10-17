import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Gift, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { money, useStore } from '@/components/store/store-context';
import { getMyLoyalty } from '@/lib/store.functions';
import { LOYALTY_DISCOUNT_THRESHOLD, LOYALTY_GIFTS } from '@/lib/loyalty';
import { PageTitle, StoreShell } from '@/components/store/store-ui';

export const Route = createFileRoute('/account')({
  head: () => ({ meta: [
    { title: 'حسابي | برستيج زون' },
    { name: 'description', content: 'تابعي مشترياتك وهدايا برنامج نقاطي في برستيج زون.' },
    { property: 'og:title', content: 'حسابي | برستيج زون' },
    { property: 'og:description', content: 'حسابك وبرنامج نقاطي في برستيج زون.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Account,
});

function Account() {
  const { session } = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loyaltyFn = useServerFn(getMyLoyalty);
  const { data: loyalty } = useQuery({ queryKey: ['loyalty', session?.user.id], queryFn: () => loyaltyFn(), enabled: !!session });
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: '/auth', replace: true });
  }
  const max = LOYALTY_GIFTS[LOYALTY_GIFTS.length - 1].amount;
  const spend = loyalty?.monthSpend ?? 0;
  return <StoreShell><main className="mx-auto min-h-[55vh] max-w-4xl px-4 py-10 sm:px-6">
    <PageTitle eyebrow="حسابك" title="حسابي" />
    {session ? <div className="space-y-6">
      <p dir="ltr" className="w-fit text-sm text-muted-foreground">{session.user.email}</p>
      <section className="store-reveal overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-primary p-5 text-primary-foreground sm:p-6"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4" />برنامج نقاطي</p><p className="mt-2 text-3xl font-extrabold">{money(spend)}</p><p className="text-sm text-primary-foreground/80">مشترياتك المؤهلة هذا الشهر</p></div>
        <div className="space-y-5 p-5 sm:p-6">
          {loyalty?.discountActive ? <div className="rounded-xl bg-secondary p-4 text-sm font-bold text-primary">🎉 خصم 3% شغال على طلباتك لحد {new Date(loyalty.discountUntil!).toLocaleDateString('ar-EG')}</div> : <div className="rounded-xl bg-secondary p-4 text-sm">فاضلك <strong className="text-primary">{money(loyalty?.remainingForDiscount ?? LOYALTY_DISCOUNT_THRESHOLD)}</strong> وتاخدي <strong>خصم 3% لمدة 30 يوم</strong> على كل طلباتك!</div>}
          <div><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>0</span><span>{money(max)}</span></div><div className="relative h-4 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-l from-brand-gold to-primary transition-[width] duration-700" style={{ width: `${Math.min(100, (spend / max) * 100)}%` }} /></div></div>
          {loyalty?.nextGift && <p className="flex items-center gap-2 text-sm"><Gift className="size-5 text-brand-gold" />فاضلك <strong>{money(loyalty.nextGift.remaining)}</strong> وتكسبي <strong>{loyalty.nextGift.gift}</strong> هدية!</p>}
          <div className="grid gap-3 sm:grid-cols-3">{LOYALTY_GIFTS.map(g => { const done = spend >= g.amount; return <div key={g.amount} className={`rounded-xl border p-4 text-center ${done ? 'border-brand-gold bg-secondary' : 'border-border'}`}><Trophy className={`mx-auto size-6 ${done ? 'text-brand-gold' : 'text-muted-foreground'}`} /><p className="mt-2 text-sm font-bold">{g.gift}</p><p className="text-xs text-muted-foreground">عند {money(g.amount)} في الشهر</p>{done && <p className="mt-1 text-xs font-bold text-primary">كسبتيها ✓</p>}</div>; })}</div>
          <p className="text-xs leading-6 text-muted-foreground">البرنامج يشمل المنتجات بسعرها الرسمي فقط — المنتجات اللي عليها خصم أو عرض مش بتتحسب، ومفيش خصمين مع بعض.</p>
          <Button asChild className="w-full sm:w-auto"><Link to="/shop" search={{ q: '', category: '', favorites: false }}>كمّلي تسوق وقرّبي من هديتك</Link></Button>
        </div>
      </section>
      <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
    </div> : <Button asChild><Link to="/auth">تسجيل الدخول</Link></Button>}
  </main></StoreShell>;
}
