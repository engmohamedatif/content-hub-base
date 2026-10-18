import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Check, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTracking } from '@/lib/store.functions';
import { TRACKING_STAGES } from '@/lib/tracking';
import { StoreShell } from '@/components/store/store-ui';

export const Route = createFileRoute('/track')({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({ meta: [
    { title: 'تتبع طلبك | برستيج زون' },
    { name: 'description', content: 'تابع حالة طلبك من برستيج زون خطوة بخطوة برقم التتبع.' },
    { property: 'og:title', content: 'تتبع طلبك | برستيج زون' },
    { property: 'og:description', content: 'تابع حالة طلبك برقم التتبع.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: TrackPage,
});

type Result = Awaited<ReturnType<typeof getTracking>>;

function TrackPage() {
  const { code: initial } = Route.useSearch();
  const fn = useServerFn(getTracking);
  const [code, setCode] = useState(initial ?? '');
  const [result, setResult] = useState<Result | undefined>();
  const [loading, setLoading] = useState(false);
  const lookup = async (c: string) => {
    if (c.trim().length < 4) return;
    setLoading(true);
    try { setResult(await fn({ data: { code: c } })); } finally { setLoading(false); }
  };
  useEffect(() => { if (initial) void lookup(initial); }, [initial]);
  const submit = (e: FormEvent) => { e.preventDefault(); void lookup(code); };

  return <StoreShell><main className="mx-auto max-w-xl px-6 py-14">
    <PackageSearch className="mx-auto size-12 text-brand-gold" />
    <h1 className="mt-4 text-center text-3xl font-bold">تتبع طلبك</h1>
    <form onSubmit={submit} className="mt-8 flex gap-2">
      <input dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="رقم التتبع" className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-center uppercase tracking-widest" />
      <Button type="submit" disabled={loading}>{loading ? '...' : 'تتبع'}</Button>
    </form>
    {result === null && <p className="mt-8 text-center text-destructive">لا يوجد طلب بهذا الرقم</p>}
    {result && <section className="mt-10 rounded-xl border border-border bg-card p-6">
      <p className="text-center text-sm text-muted-foreground">رقم التتبع <span dir="ltr" className="font-bold text-foreground">{result.code}</span></p>
      {result.cancelled ? <p className="mt-6 text-center text-destructive font-bold">تم إلغاء هذا الطلب</p> :
      <ol className="mt-8 space-y-6">
        {TRACKING_STAGES.map((label, i) => {
          const done = i <= result.stage; const current = i === result.stage;
          return <li key={label} className="flex items-center gap-4">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-brand-gold bg-brand-gold text-background' : 'border-border text-muted-foreground'}`}>{done ? <Check className="size-5" /> : i}</span>
            <span className={`${current ? 'font-bold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}{current && result.updatedAt && <span className="block text-xs font-normal text-muted-foreground">{new Date(result.updatedAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</span>}</span>
          </li>;
        })}
      </ol>}
    </section>}
  </main></StoreShell>;
}
