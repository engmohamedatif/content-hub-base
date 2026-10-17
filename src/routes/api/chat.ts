import { createFileRoute } from '@tanstack/react-router';
import { createOpenAI } from '@ai-sdk/openai';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { categories } from '@/lib/catalog-categories';
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from '@/lib/ai-run-id.server';

const MODEL = 'openai/gpt-6-luna';

const SALES_PROMPT = `إنت "زيزو"، مساعد المبيعات وخدمة العملاء في متجر "برستيج زون" في مصر. بتتكلم مصري عامي بسيط ودافي، زي بياع شاطر وأمين في محل جيران بيحب زباينه ويخاف على جيبهم.

هدفك: تفهم احتياج العميل كويس، وترشحله الأنسب ليه فعلاً مش الأغلى، وتخليه يحس إنك في صفه وعايز مصلحته، وتساعده يكمل الشراء بسهولة.

إزاي تبيع صح:
١. اسمع الأول: لو الطلب عام، اسأل سؤال واحد خفيف يحدد الاحتياج (نوع الشعر، سن الطفل، المقاس، الميزانية) قبل ما ترشح.
٢. رشّح بثقة وصدق: اختار من نتيجة البحث من ١ لـ ٣ منتجات بس، وقول ليه كل واحد مناسب له بجملة قصيرة بتربط بين المنتج ومشكلته. لو فيه خصم شغال، وضّح قد إيه هيوفر بالجنيه.
٣. خلّيه يحس بالمكسب: ركّز على الفايدة اللي هيحسها (شعر أنعم، طفل مرتاح، بيت ريحته حلوة) والتوفير، من غير مبالغة.
٤. البيع المكمّل بذوق: بعد ما يختار، اقترح منتج واحد مكمّل لو موجود فعلاً في المتجر (شامبو ← بلسم، حفاضات ← مناديل)، وقدّمه كنصيحة مش ضغط.
٥. اقفل بلطف: اختم دايماً بسؤال واحد بيحرّك الخطوة الجاية، زي "أضيفهولك في السلة؟" أو "تحب تاخد اتنين وتوفر مشوار؟".
٦. لو العميل متردد أو السعر مش مناسب: اعرض بديل أوفر من نفس القسم لو موجود، وطمّنه إن الدفع ممكن كاش عند الاستلام.

قواعد صارمة لا تتكسر أبداً:
- ممنوع تخترع أي منتج أو سعر أو خصم أو كمية أو ماركة أو ميزة. أي معلومة عن منتج لازم تيجي من أداة search_products بس. لو ملقتش، قول بصراحة إنه مش متوفر حالياً واقترح حاجة قريبة موجودة أو اطلب توضيح.
- ممنوع تحدد أي ميعاد أو مدة توصيل أو مصاريف شحن. قول إن فريق المتجر هيتواصل معاه على تليفونه بعد الطلب لتأكيد التفاصيل.
- لما العميل يطلب يضيف منتج للسلة، استخدم أداة add_to_cart بالـ id الحقيقي من نتيجة البحث، وبعدها أكّدله إنه اتضاف. ماتقولش "اتضاف" قبل ما الأداة ترجع نجاح.
- طرق الدفع: كاش عند الاستلام، أو إنستا باي أو فودافون كاش على 01041610065 مع رفع صورة الإيصال في صفحة إتمام الطلب. مفيش تقسيط.
- اتكلم في المتجر ومنتجاته بس، ولو السؤال بعيد رجّعه بلطف.
- ردودك قصيرة ومرتبة: فقرات صغيرة أو نقاط، إيموجي واحد أو اتنين بالكتير، وبلاش كلام جاف أو رسمي.

الأقسام المتاحة:
${categories.map(c => `- ${c.name}: ${c.subs.join('، ')}`).join('\n')}`;

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('Store unavailable');
  return createClient(url, key, { global: { headers: { apikey: key } }, auth: { persistSession: false, autoRefreshToken: false } });
}

type Row = { id: string; name: string; category: string; subcategory: string | null; price: number; discount_amount: number; discount_until: string | null; stock: number; card_description: string };
const finalPrice = (p: Row) => p.discount_until && new Date(p.discount_until).getTime() > Date.now() ? Math.max(0, p.price - p.discount_amount) : p.price;

const bodySchema = z.object({ messages: z.array(z.any()).max(60) });

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: 'المساعد غير متاح حالياً' }, { status: 500 });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: 'طلب غير صالح' }, { status: 400 });
        const messages = parsed.data.messages.slice(-30) as UIMessage[];
        const db = publicClient();
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({ baseURL: 'https://ai.gateway.lovable.dev/v1', apiKey, headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' }, fetch: runIdFetch.fetch });
        const result = streamText({
          model: provider.responses(MODEL),
          instructions: SALES_PROMPT,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          stopWhen: stepCountIs(5),
          providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', include: ['reasoning.encrypted_content'] } },
          tools: {
            search_products: tool({
              description: 'ابحث في منتجات المتجر المتاحة داخل قسم معيّن و/أو بكلمة. استخدمها قبل ذكر أي منتج.',
              inputSchema: z.object({
                category: z.enum(categories.map(c => c.name) as [string, ...string[]]).nullable().describe('القسم الأنسب لطلب العميل'),
                query: z.string().nullable().describe('كلمة بحث قصيرة مثل شامبو أو حفاضات'),
                only_discounted: z.boolean().nullable(),
              }),
              execute: async ({ category, query, only_discounted }) => {
                let q = db.from('products').select('id,name,category,subcategory,price,discount_amount,discount_until,stock,card_description').eq('active', true).gt('stock', 0).limit(40);
                if (category) q = q.eq('category', category);
                const { data, error } = await q;
                if (error) return { error: 'تعذر البحث الآن' };
                const words = (query ?? '').trim().split(/\s+/).filter(w => w.length > 1);
                let rows = (data ?? []) as Row[];
                if (words.length) {
                  const matched = rows.filter(p => words.some(w => `${p.name} ${p.subcategory ?? ''} ${p.card_description}`.includes(w)));
                  if (matched.length || !category) rows = matched;
                }
                if (only_discounted) rows = rows.filter(p => finalPrice(p) < p.price);
                return { products: rows.slice(0, 8).map(p => ({ id: p.id, name: p.name, category: p.category, type: p.subcategory, price_before: p.price, price_now: finalPrice(p), in_stock: p.stock, summary: p.card_description })), note: rows.length ? undefined : 'لا توجد منتجات مطابقة حالياً' };
              },
            }),
            add_to_cart: tool({
              description: 'أضف منتجاً حقيقياً لسلة العميل عندما يطلب ذلك صراحة.',
              inputSchema: z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) }),
              execute: async ({ product_id, quantity }) => {
                const { data } = await db.from('products').select('id,name,stock').eq('id', product_id).eq('active', true).maybeSingle();
                if (!data) return { ok: false, reason: 'المنتج غير موجود' };
                if (data.stock < quantity) return { ok: false, reason: `المتاح ${data.stock} فقط` };
                return { ok: true, product_id: data.id, name: data.name, quantity };
              },
            }),
          },
        });
        return withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ originalMessages: messages, onError: (e) => { console.error('chat error', e); return 'المساعد مش متاح دلوقتي، جرب تاني بعد شوية'; } }), runIdFetch);
      },
    },
  },
});
