import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import { Link } from '@tanstack/react-router';
import { MessageCircleHeart, Plus, RotateCcw, SendHorizonal, ShoppingCart, X } from 'lucide-react';
import logoUrl from '@/assets/prestige-zone-logo.jpg';
import { money, priceOf, useStore } from './store-context';

const STORAGE = 'prestige-assistant-chat';
const PHONE = '01041610065';

const quick: { label: string; answer?: string; ask?: string }[] = [
  { label: '🔥 أقوى العروض', ask: 'إيه أقوى العروض والخصومات عندكم دلوقتي؟' },
  { label: '💳 طرق الدفع', answer: `تقدر تدفع بأي طريقة تريحك 👌\n\n- **كاش عند الاستلام**\n- **إنستا باي** على \`${PHONE}\`\n- **فودافون كاش** على \`${PHONE}\`\n\nلو حوّلت، ارفع صورة الإيصال في صفحة إتمام الطلب. ومفيش تقسيط.` },
  { label: '🚚 التوصيل', answer: 'بنوصّل لحد باب البيت 🏠\n\nبعد ما تأكد الطلب، فريق برستيج زون هيكلمك على تليفونك يأكد معاك العنوان وتفاصيل التوصيل.' },
  { label: '📦 أطلب إزاي؟', answer: '١. اختار المنتج ودوس **أضف للسلة** (أو قولي "ضيفه للسلة" وأنا أضيفه).\n٢. افتح **السلة** ودوس إتمام الطلب.\n٣. اكتب اسمك وتليفونك وعنوانك واختار طريقة الدفع.\n\nوخلاص! 🎉' },
  { label: '💬 كلم حد من المتجر', answer: `أكيد 🤝 تقدر تكلمنا أو تبعت واتساب على **${PHONE}**.\n\n[افتح واتساب](https://wa.me/2${PHONE})` },
];

const welcome: UIMessage = { id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: 'أهلاً بيك في **برستيج زون** 👋\nأنا زيزو، قولي محتاج إيه وأنا أختارلك الأنسب ليك وبأحسن سعر.' }] };

function loadMessages(): UIMessage[] {
  if (typeof window === 'undefined') return [welcome];
  try { const m = JSON.parse(localStorage.getItem(STORAGE) ?? 'null'); return Array.isArray(m) && m.length ? m : [welcome]; } catch { return [welcome]; }
}

type ToolPart = { type: string; toolCallId: string; state: string; output?: unknown };
type FoundProduct = { id: string; name: string };

export function CustomerChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(false);
  const { products, addToCart } = useStore();
  const applied = useRef<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: 'prestige-assistant',
    messages: loadMessages(),
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    // Mark carts already applied in restored history so reloads never re-add items.
    for (const m of messages) for (const p of m.parts as ToolPart[]) if (p.type === 'tool-add_to_cart') applied.current.add(p.toolCallId);
    const t = setTimeout(() => setHint(true), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const m of messages) for (const p of m.parts as ToolPart[]) {
      if (p.type !== 'tool-add_to_cart' || p.state !== 'output-available' || applied.current.has(p.toolCallId)) continue;
      applied.current.add(p.toolCallId);
      const out = p.output as { ok?: boolean; product_id?: string; quantity?: number };
      if (out?.ok && out.product_id) addToCart(out.product_id, out.quantity ?? 1);
    }
    if (status === 'ready' || status === 'error') localStorage.setItem(STORAGE, JSON.stringify(messages.slice(-40)));
  }, [messages, status, addToCart]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, status, open]);
  useEffect(() => { if (open && !busy) inputRef.current?.focus(); }, [open, busy]);

  const send = (text: string) => { const t = text.trim(); if (!t || busy) return; setInput(''); sendMessage({ text: t }); };
  const quickReply = (q: typeof quick[number]) => {
    if (q.ask) return send(q.ask);
    const id = crypto.randomUUID();
    setMessages([...messages, { id: `u-${id}`, role: 'user', parts: [{ type: 'text', text: q.label.replace(/^\S+\s/, '') }] }, { id: `a-${id}`, role: 'assistant', parts: [{ type: 'text', text: q.answer! }] }]);
  };
  const reset = () => { stop(); localStorage.removeItem(STORAGE); setMessages([welcome]); };

  return <>
    {!open && <div className="fixed bottom-20 left-4 z-50 flex items-end gap-2 md:bottom-6 md:left-6">
      <button type="button" onClick={() => setOpen(true)} aria-label="افتح مساعد برستيج زون" className="chat-launcher relative grid size-16 place-items-center rounded-full bg-gradient-to-br from-primary to-brand-gold text-primary-foreground shadow-2xl transition-transform hover:scale-110">
        <MessageCircleHeart className="size-8" /><span className="absolute top-1 right-1 size-3.5 rounded-full border-2 border-card bg-sale" />
      </button>
      {hint && <button type="button" onClick={() => setOpen(true)} className="chat-pop mb-2 hidden rounded-2xl rounded-bl-sm bg-card px-4 py-2 text-sm font-bold shadow-xl sm:block">محتار تختار إيه؟ اسألني 👋</button>}
    </div>}

    {open && <section dir="rtl" className="chat-pop fixed inset-0 z-50 flex flex-col overflow-hidden bg-background sm:inset-auto sm:bottom-6 sm:left-6 sm:h-[min(640px,calc(100vh-3rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-border sm:shadow-2xl">
      <header className="relative flex items-center gap-3 bg-gradient-to-l from-primary via-primary to-brand-gold px-4 py-3.5 text-primary-foreground">
        <img src={logoUrl} alt="" className="size-11 rounded-2xl object-cover ring-2 ring-primary-foreground/30" />
        <div className="min-w-0 flex-1"><h2 className="font-extrabold">زيزو • مساعد برستيج زون</h2><p className="flex items-center gap-1.5 text-xs text-primary-foreground/80"><span className="size-2 animate-pulse rounded-full bg-sale" />متاح دلوقتي وبيرد فوراً</p></div>
        <button type="button" onClick={reset} aria-label="محادثة جديدة" className="grid size-9 place-items-center rounded-full hover:bg-primary-foreground/15"><RotateCcw className="size-4" /></button>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid size-9 place-items-center rounded-full hover:bg-primary-foreground/15"><X className="size-5" /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto bg-secondary/40 px-3 py-4">
        {messages.map(m => <div key={m.id} className={`chat-msg flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[88%] space-y-2 ${m.role === 'user' ? 'rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground' : ''}`}>
            {m.parts.map((p, i) => {
              if (p.type === 'text') return m.role === 'user' ? <p key={i} className="whitespace-pre-wrap text-[15px]">{p.text}</p> : <div key={i} className="chat-md rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-[15px] leading-7 shadow-sm"><ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-bold text-primary underline">{children}</a> }}>{p.text}</ReactMarkdown></div>;
              const tp = p as unknown as ToolPart;
              if (tp.type === 'tool-search_products' && tp.state === 'output-available') {
                const found = ((tp.output as { products?: FoundProduct[] })?.products ?? []).map(f => products.find(x => x.id === f.id)).filter(Boolean).slice(0, 4);
                return found.length ? <div key={i} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{found.map(prod => prod && <div key={prod.id} className="w-36 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
                  <Link to="/product/$id" params={{ id: prod.id }} onClick={() => setOpen(false)} className="block aspect-square bg-secondary">{prod.image_urls[0] && <img src={prod.image_urls[0]} alt={prod.name} className="h-full w-full object-cover" />}</Link>
                  <div className="p-2"><p className="line-clamp-2 text-xs font-bold">{prod.name}</p><p className="mt-1 text-sm font-extrabold text-primary">{money(priceOf(prod))}{priceOf(prod) < prod.price && <span className="mr-1 text-[10px] text-muted-foreground line-through">{money(prod.price)}</span>}</p>
                    <button type="button" onClick={() => addToCart(prod.id)} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-xs font-bold text-primary-foreground"><Plus className="size-3" />للسلة</button></div>
                </div>)}</div> : null;
              }
              if (tp.type === 'tool-add_to_cart' && tp.state === 'output-available') {
                const out = tp.output as { ok?: boolean; name?: string; quantity?: number; reason?: string };
                return <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${out.ok ? 'bg-sale/40 text-sale-foreground' : 'bg-destructive/10 text-destructive'}`}><ShoppingCart className="size-4" />{out.ok ? `اتضاف ${out.quantity} × ${out.name} للسلة` : out.reason}</div>;
              }
              if (tp.type.startsWith('tool-') && tp.state !== 'output-available') return <p key={i} className="text-xs text-muted-foreground">بدوّرلك في المتجر…</p>;
              return null;
            })}
          </div>
        </div>)}
        {status === 'submitted' && <div className="flex justify-end"><div className="flex gap-1.5 rounded-2xl rounded-tl-sm bg-card px-4 py-3.5 shadow-sm">{[0, 1, 2].map(d => <span key={d} className="chat-dot size-2 rounded-full bg-primary" style={{ animationDelay: `${d * 0.15}s` }} />)}</div></div>}
        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">المساعد مش متاح دلوقتي، جرب تاني بعد شوية أو كلمنا على {PHONE}</p>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-card px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">{quick.map(q => <button key={q.label} type="button" disabled={busy} onClick={() => quickReply(q)} className="shrink-0 rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50">{q.label}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex items-end gap-2 rounded-2xl border-2 border-primary/15 bg-background p-1.5 focus-within:border-primary">
          <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="اكتب طلبك… مثلاً: عايز شامبو للشعر الجاف" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none" />
          {busy ? <button type="button" onClick={stop} aria-label="إيقاف" className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><X className="size-4" /></button>
            : <button type="submit" disabled={!input.trim()} aria-label="إرسال" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><SendHorizonal className="size-4 rotate-180" /></button>}
        </form>
      </div>
    </section>}
  </>;
}
