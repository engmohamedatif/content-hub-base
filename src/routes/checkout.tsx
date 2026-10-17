import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { CheckCircle2, Upload, MapPin, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createOrder, getMyLoyalty, getZones } from '@/lib/store.functions';
import { discountOf, money, priceOf, useStore } from '@/components/store/store-context';
import { loyaltyDiscountFor, orderTotal } from '@/lib/loyalty';
import { PageTitle, StoreShell } from '@/components/store/store-ui';

const formSchema = z.object({ name: z.string().trim().min(2,'اكتب الاسم بالكامل'), phone: z.string().trim().regex(/^01[0-9]{9}$/,'اكتب رقم موبايل مصري صحيح'), address: z.string().trim().min(8,'اكتب العنوان بالتفصيل'), notes: z.string().max(1000) });
const PAYMENTS = [['instapay','إنستا باي'],['vodafone','فودافون كاش'],['cod','كاش عند الاستلام']] as const;
type Pay = typeof PAYMENTS[number][0];

export const Route = createFileRoute('/checkout')({ head: () => ({ meta: [{ title: 'إتمام الطلب | برستيج زون' }, { name: 'description', content: 'اختر منطقتك وطريقة الدفع وأكمل طلبك من برستيج زون.' }, { property: 'og:title', content: 'إتمام الطلب | برستيج زون' }, { property: 'og:description', content: 'أكمل طلبك واختر طريقة الدفع المناسبة.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Checkout });

function Checkout() {
  const { products, cart, clearCart, session } = useStore();
  const orderFn = useServerFn(createOrder);
  const zonesFn = useServerFn(getZones);
  const loyaltyFn = useServerFn(getMyLoyalty);
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: () => zonesFn() });
  const { data: loyalty } = useQuery({ queryKey: ['loyalty', session?.user.id], queryFn: () => loyaltyFn(), enabled: !!session });
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [zoneId, setZoneId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Pay>('instapay');
  const [proof, setProof] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const lines = cart.map(line => ({ line, product: products.find(p => p.id === line.id) })).filter(x => x.product);
  const subtotal = lines.reduce((sum, x) => sum + priceOf(x.product!) * x.line.quantity, 0);
  const eligible = lines.filter(x => discountOf(x.product!) === 0).reduce((sum, x) => sum + priceOf(x.product!) * x.line.quantity, 0);
  const zone = zones.find(z => z.id === zoneId);
  const loyaltyDiscount = loyaltyDiscountFor(eligible, !!loyalty?.discountActive);
  const total = orderTotal(subtotal, loyaltyDiscount, zone?.fee ?? 0);

  function locate() {
    setError('');
    if (!navigator.geolocation) { setError('جهازك لا يدعم تحديد الموقع'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); }, () => { setError('لم نتمكن من تحديد موقعك، تأكد من السماح بالوصول للموقع'); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000 });
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const result = formSchema.safeParse(form);
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'تأكد من البيانات'); return; }
    if (!lines.length) { setError('السلة فارغة'); return; }
    if (!zone) { setError('اختر مدينتك / منطقتك للتوصيل'); return; }
    if (paymentMethod !== 'cod' && !proof) { setError('ارفع صورة إيصال التحويل لإتمام الدفع الإلكتروني'); return; }
    if (proof && (proof.size > 5_000_000 || !['image/jpeg','image/png','image/webp'].includes(proof.type))) { setError('ارفع صورة JPG أو PNG أو WEBP بحجم أقل من ٥ ميجابايت'); return; }
    setBusy(true);
    try {
      let encoded: { base64: string; type: 'image/jpeg'|'image/png'|'image/webp' } | undefined;
      if (proof) { const bytes = new Uint8Array(await proof.arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); encoded = { base64: btoa(binary), type: proof.type as 'image/jpeg'|'image/png'|'image/webp' }; }
      const response = await orderFn({ data: { ...result.data, paymentMethod, zoneId: zone.id, location, items: lines.map(x => ({ productId: x.line.id, quantity: x.line.quantity })), proof: encoded } });
      setSuccess(response.id); clearCart();
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب، حاول مرة أخرى'); } finally { setBusy(false); }
  }

  if (success) return <StoreShell><main className="mx-auto max-w-lg px-6 py-20 text-center"><CheckCircle2 className="mx-auto size-16 text-brand-gold" /><h1 className="mt-6 text-3xl font-bold">تم استلام طلبك بنجاح</h1><p className="mt-4 text-muted-foreground">رقم الطلب: <span dir="ltr">{success.slice(0,8).toUpperCase()}</span></p><p className="mt-2 text-sm text-muted-foreground">فريق برستيج زون هيتواصل معاك على تليفونك لتأكيد الطلب.</p><Button asChild className="mt-8"><Link to="/">العودة للرئيسية</Link></Button></main></StoreShell>;

  return <StoreShell><main className="mx-auto min-h-[55vh] max-w-7xl px-4 py-10 sm:px-6">
    <PageTitle eyebrow="الخطوة الأخيرة" title="إتمام الطلب" />
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form id="checkout" onSubmit={submit} className="space-y-8">
        <section><h2 className="mb-4 text-xl font-bold">بيانات التوصيل</h2><div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">الاسم بالكامل<input required maxLength={100} className="field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="space-y-2 text-sm">رقم الموبايل<input required inputMode="tel" maxLength={11} className="field" placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="space-y-2 text-sm sm:col-span-2">المدينة / المنطقة<select required className="field" value={zoneId} onChange={e => setZoneId(e.target.value)}><option value="">اختر منطقتك</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name} — توصيل {money(z.fee)}</option>)}</select>{!zones.length && <span className="block text-xs text-muted-foreground">لا توجد مناطق توصيل متاحة حالياً.</span>}</label>
          <label className="space-y-2 text-sm sm:col-span-2">العنوان بالتفصيل<textarea required className="field min-h-24" value={form.address} maxLength={500} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
          <div className="sm:col-span-2"><Button type="button" variant={location ? 'secondary' : 'outline'} className="w-full rounded-xl" onClick={locate} disabled={locating}><MapPin className="size-5" />{locating ? 'جاري تحديد موقعك...' : location ? 'تم تحديد موقعك بدقة ✓ (اضغط للتحديث)' : 'حدد موقعي الحالي بدقة للتوصيل'}</Button>{location && <a className="mt-2 block text-center text-xs text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}>عرض موقعي على الخريطة</a>}</div>
          <label className="space-y-2 text-sm sm:col-span-2">ملاحظات للطلب (اختياري)<textarea className="field min-h-20" value={form.notes} maxLength={1000} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        </div></section>
        <section><h2 className="mb-4 text-xl font-bold">طريقة الدفع</h2><div className="space-y-3">{PAYMENTS.map(([key,label]) => <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${paymentMethod === key ? 'border-brand-gold bg-secondary/40' : 'border-border'}`}><input type="radio" name="payment" checked={paymentMethod === key} onChange={() => { setPaymentMethod(key); setProof(null); }} className="accent-primary" /><span className="font-medium">{label}</span></label>)}</div>
          {paymentMethod !== 'cod' && <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-5"><p className="text-sm leading-7">حوّل <strong>{money(total)}</strong> إلى رقم <strong dir="ltr" className="inline-block">01041610065</strong> عبر {paymentMethod === 'instapay' ? 'إنستا باي' : 'فودافون كاش'}. صورة إيصال التحويل مطلوبة لإتمام الطلب.</p><label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-primary"><Upload className="size-5" />{proof ? proof.name : 'ارفع صورة إيصال التحويل (مطلوب)'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => setProof(e.target.files?.[0] ?? null)} /></label></div>}
        </section>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
      <aside className="h-fit rounded-2xl border border-border p-5 sm:p-6"><h2 className="text-lg font-bold">ملخص الطلب</h2>
        {lines.map(({line,product}) => product && <div key={line.id} className="flex justify-between gap-4 border-b border-border py-3 text-sm"><span>{product.name} × {line.quantity}</span><span className="shrink-0">{money(priceOf(product) * line.quantity)}</span></div>)}
        <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>المنتجات</span><span>{money(subtotal)}</span></div>
          {loyaltyDiscount > 0 && <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><Gift className="size-4" />خصم نقاطي 3%</span><span>-{money(loyaltyDiscount)}</span></div>}
          <div className="flex justify-between"><span>التوصيل{zone ? ` (${zone.name})` : ''}</span><span>{zone ? money(zone.fee) : 'اختر منطقتك'}</span></div></div>
        <div className="mt-4 flex justify-between border-t border-border pt-4 text-lg font-bold"><span>الإجمالي النهائي</span><span>{money(total)}</span></div>
        {session && loyalty && !loyalty.discountActive && <p className="mt-3 text-xs leading-6 text-muted-foreground">فاضلك {money(loyalty.remainingForDiscount)} من المنتجات غير المخفضة هذا الشهر وتاخد خصم 3% لمدة 30 يوم.</p>}
        <Button type="submit" form="checkout" className="mt-6 w-full" size="lg" disabled={busy || !lines.length}>{busy ? 'جاري إرسال الطلب...' : 'تأكيد الطلب'}</Button>
      </aside>
    </div>
  </main></StoreShell>;
}
