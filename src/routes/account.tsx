import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Gift, Sparkles, Trophy, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { money, useStore } from '@/components/store/store-context';
import { getMyLoyalty, getMyTracking, saveRewardPhone } from '@/lib/store.functions';
import { LOYALTY_DISCOUNT_THRESHOLD, LOYALTY_GIFTS } from '@/lib/loyalty';
import { useEffect, useState, type FormEvent } from 'react';
import { getRecentTrackingCodes, TRACKING_STAGES } from '@/lib/tracking';
import { RewardCelebration } from '@/components/store/RewardCelebration';
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
  const trackingFn = useServerFn(getMyTracking);
  const phoneFn = useServerFn(saveRewardPhone);
  const { data: orders = [] } = useQuery({ queryKey: ['my-tracking', session?.user.id], queryFn: () => trackingFn(), enabled: !!session });
  const [recent, setRecent] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setRecent(getRecentTrackingCodes()); }, []);
  async function submitPhone(e: FormEvent) {
    e.preventDefault(); setSaving(true); setContact('');
    try { await phoneFn({ data: { phone } }); setContact('تم إرسال رقمك لفريق برستيج زون للتواصل معاكي بخصوص هديتك ✓'); }
    catch (error) { setContact(error instanceof Error ? error.message : 'تعذر إرسال الرقم'); }
    finally { setSaving(false); }
  }
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: '/auth', replace: true });
  }
  const max = LOYALTY_GIFTS[LOYALTY_GIFTS.length - 1]?.amount ?? 0;
  const spend = loyalty?.monthSpend ?? 0;
  return <StoreShell><main className="mx-auto min-h-[55vh] max-w-4xl px-4 py-10 sm:px-6">
    <PageTitle eyebrow="حسابك" title="حسابي" />
    <section className="mb-8 border-b border-border pb-6"><h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><PackageSearch className="size-5 text-primary" />شحناتي</h2><Button asChild variant="outline"><Link to="/track">تتبع الشحنة</Link></Button><div className="mt-4 flex flex-wrap gap-3">{orders.map(o => <Button asChild variant="outline" key={o.tracking_code}><Link to="/track" search={{ code: o.tracking_code }}><span dir="ltr">{o.tracking_code}</span> — {o.status === 'cancelled' ? 'ملغي' : TRACKING_STAGES[Math.min(o.tracking_stage, 3)]}</Link></Button>)}{recent.filter(c => !orders.some(o => o.tracking_code === c)).map(c => <Button asChild variant="outline" key={c}><Link to="/track" search={{ code: c }}><span dir="ltr">{c}</span></Link></Button>)}</div></section>
    {session ? <div className="space-y-6">
      <p dir="ltr" className="w-fit text-sm text-muted-foreground">{session.user.email}</p>
      <section className="store-reveal overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-primary p-5 text-primary-foreground sm:p-6"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4" />برنامج نقاطي</p><p className="mt-2 text-3xl font-extrabold">{money(spend)}</p><p className="text-sm text-primary-foreground/80">مشترياتك المؤهلة هذا الشهر</p></div>
        <div className="space-y-5 p-5 sm:p-6">
          {loyalty?.earnedGifts.length ? <RewardCelebration rewardKey={`${session.user.id}:${new Date().getFullYear()}-${new Date().getMonth()}:${loyalty.earnedGifts.length}`} message={`كسبتي ${loyalty.earnedGifts.join(' و ')}! الهدايا بتحل محل خصم ٣٪؛ سجّلي رقمك عشان نتواصل معاكي.`} /> : loyalty?.nextMonthDiscount ? <RewardCelebration rewardKey={`${session.user.id}:${loyalty.nextMonthLabel}:discount`} message={`وصلتي للألف! كسبتي خصم ٣٪ طوال شهر ${loyalty.nextMonthLabel}. كمّلي وقرّبي من هديتك!`} /> : <p className="text-sm leading-7">فاضلك <strong className="text-primary">{money(loyalty?.remainingForDiscount ?? LOYALTY_DISCOUNT_THRESHOLD)}</strong> وتاخدي <strong>خصم ٣٪ طول الشهر اللي بعده</strong> — كل خطوة بتقرّبك!</p>}
          {loyalty?.discountActive && loyalty.discountUntil && <p className="text-sm font-bold text-primary">خصم ٣٪ شغال طوال الشهر الحالي، لحد نهاية {new Date(new Date(loyalty.discountUntil).getTime() - 1).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' })}</p>}
          {spend >= 3000 && <form onSubmit={submitPhone} className="space-y-3 border-y border-border py-5"><label className="block text-sm font-bold" htmlFor="reward-phone">رقم موبايلك للتواصل بخصوص هديتك</label><div className="flex flex-wrap gap-2"><input id="reward-phone" required inputMode="tel" maxLength={11} pattern="01[0-9]{9}" dir="ltr" className="field flex-1" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" /><Button type="submit" disabled={saving}>{saving ? 'جاري الإرسال...' : 'سجّلي رقمك'}</Button></div>{contact && <p role="status" className="text-sm">{contact}</p>}</form>}
          <div><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>0</span><span>{money(max)}</span></div><div className="relative h-4 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-l from-brand-gold to-primary transition-[width] duration-700" style={{ width: `${Math.min(100, (spend / max) * 100)}%` }} /></div></div>
          {loyalty?.nextGift && <p className="flex items-center gap-2 text-sm"><Gift className="size-5 text-brand-gold" />فاضلك <strong>{money(loyalty.nextGift.remaining)}</strong> وتكسبي <strong>{loyalty.nextGift.gift}</strong> هدية! إنتي أقرب مما تتخيلي، كمّلي مشوارك</p>}
          <div className="grid gap-3 sm:grid-cols-3">{LOYALTY_GIFTS.map(g => { const done = spend >= g.amount; return <div key={g.amount} className={`rounded-xl border p-4 text-center ${done ? 'border-brand-gold bg-secondary' : 'border-border'}`}><Trophy className={`mx-auto size-6 ${done ? 'text-brand-gold' : 'text-muted-foreground'}`} /><p className="mt-2 text-sm font-bold">{g.gift}</p><p className="text-xs text-muted-foreground">عند {money(g.amount)} في الشهر</p>{done && <p className="mt-1 text-xs font-bold text-primary">كسبتيها ✓</p>}</div>; })}</div>
          <p className="text-xs leading-6 text-muted-foreground">البرنامج يشمل المنتجات بسعرها الرسمي فقط — المنتجات اللي عليها خصم أو عرض مش بتتحسب، والشحن مش بيتحسب. عند ١٠٠٠ جنيه تاخدي خصم الشهر التالي كله؛ عند ٣٠٠٠ جنيه الهدايا بتحل محل خصم ٣٪ ومش بيتجمعوا.</p>
          <Button asChild className="w-full sm:w-auto"><Link to="/shop" search={{ q: '', category: '', favorites: false }}>كمّلي تسوق وقرّبي من هديتك</Link></Button>
        </div>
      </section>
      <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
    </div> : <Button asChild><Link to="/auth">تسجيل الدخول</Link></Button>}
  </main></StoreShell>;
}
