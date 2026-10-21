import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

const emailSchema = z.string().trim().email().max(255);
const itemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) });
const orderSchema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().regex(/^01[0-9]{9}$/), address: z.string().trim().min(8).max(500), notes: z.string().trim().max(1000), paymentMethod: z.enum(['cod','instapay','vodafone']), items: z.array(itemSchema).min(1).max(50), zoneId: z.string().uuid(), location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(), proof: z.object({ base64: z.string().min(1).max(9500000), type: z.enum(['image/jpeg','image/png','image/webp']) }).optional() });

function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('Store unavailable');
  return createClient<Database>(url, key, { global: { fetch: (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    if (headers.get('Authorization') === `Bearer ${key}` && key.startsWith('sb_publishable_')) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export const PAGE_SIZE = 10;

async function signProductImages<T extends { image_urls: string[] }>(product: T) {
  if (!product.image_urls.some(path => !path.startsWith('https://'))) return product;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const image_urls = await Promise.all(product.image_urls.map(async path => {
    if (path.startsWith('https://')) return path;
    const { data: signed } = await supabaseAdmin.storage.from('product-images').createSignedUrl(path, 3600);
    return signed?.signedUrl ?? '';
  }));
  return { ...product, image_urls };
}

const catalogPageSchema = z.object({
  page: z.number().int().min(0).max(1000).default(0),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  q: z.string().max(100).optional(),
  favorites: z.array(z.string().uuid()).max(100).optional(),
  deals: z.boolean().optional(),
});

// Catalog is paginated server-side: the browser never loads the whole product list at once.
export const getCatalogPage = createServerFn({ method: 'GET' }).inputValidator(input => catalogPageSchema.parse(input ?? {})).handler(async ({ data }) => {
  let query = publicClient().from('products').select('*', { count: 'exact' }).eq('active', true);
  if (data.category) query = query.eq('category', data.category);
  if (data.subcategory) query = query.eq('subcategory', data.subcategory);
  if (data.deals) query = query.gt('discount_amount', 0);
  if (data.favorites) query = query.in('id', data.favorites);
  if (data.q) {
    const term = data.q.replace(/[%_,()\\]/g, ' ').trim();
    if (term) query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%,subcategory.ilike.%${term}%`);
  }
  const from = data.page * PAGE_SIZE;
  const { data: rows, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error('تعذر تحميل المنتجات');
  const items = await Promise.all((rows ?? []).map(signProductImages));
  return { items, total: count ?? items.length };
});

export const getProductsByIds = createServerFn({ method: 'GET' }).inputValidator(input => z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }).parse(input)).handler(async ({ data }) => {
  const { data: rows, error } = await publicClient().from('products').select('*').eq('active', true).in('id', data.ids);
  if (error) throw new Error('تعذر تحميل المنتجات');
  return Promise.all((rows ?? []).map(signProductImages));
});

async function loyaltyFor(supabaseAdmin: any, userId: string) {
  const { loyaltyStatus } = await import('./loyalty');
  const { data, error } = await supabaseAdmin.from('orders').select('created_at, status, order_items(quantity, unit_price, loyalty_eligible)').eq('user_id', userId).neq('status', 'cancelled');
  if (error) throw new Error('تعذر حساب المكافآت');
  const orders = (data ?? []).map((o: any) => ({ created_at: o.created_at, eligible_amount: (o.order_items ?? []).filter((i: any) => i.loyalty_eligible).reduce((s: number, i: any) => s + Number(i.unit_price) * i.quantity, 0) }));
  return loyaltyStatus(orders);
}

async function userIdFromRequest(supabaseAdmin: any): Promise<string | null> {
  const { getRequestHeader } = await import('@tanstack/react-start/server');
  const authorization = getRequestHeader('authorization');
  if (!authorization) return null;
  const bearer = authorization.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw new Error('جلسة الحساب غير صالحة');
  const { data: auth, error } = await supabaseAdmin.auth.getUser(bearer);
  if (error || !auth.user) throw new Error('جلسة الحساب غير صالحة');
  return auth.user.id;
}

export const createOrder = createServerFn({ method: 'POST' }).inputValidator((input) => orderSchema.parse(input)).handler(async ({ data }) => {
  if (data.paymentMethod !== 'cod' && !data.proof) throw new Error('صورة إيصال التحويل مطلوبة للدفع الإلكتروني');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { eligibleItemAmount, loyaltyDiscountFor, orderTotal } = await import('./loyalty');
  const userId = await userIdFromRequest(supabaseAdmin);
  const { data: zone } = await supabaseAdmin.from('delivery_zones').select('id, name, fee').eq('id', data.zoneId).eq('active', true).maybeSingle();
  if (!zone) throw new Error('اختر منطقة التوصيل');
  const quantities = new Map<string, number>();
  data.items.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity));
  const ids = [...quantities.keys()];
  const { data: products, error: productsError } = await supabaseAdmin.from('products').select('*').in('id', ids).eq('active', true);
  if (productsError || !products || products.length !== ids.length) throw new Error('بعض المنتجات لم تعد متاحة');
  const now = Date.now();
  const items = products.map(product => {
    const quantity = quantities.get(product.id) ?? 0;
    if (quantity > product.stock) throw new Error(`الكمية غير متاحة: ${product.name}`);
    const onSale = !!product.discount_until && new Date(product.discount_until).getTime() > now && product.discount_amount > 0;
    const price = onSale ? Math.max(0, product.price - product.discount_amount) : product.price;
    return { product_id: product.id, product_name: product.name, quantity, unit_price: price, loyalty_eligible: !onSale };
  });
  let proofPath: string | null = null;
  if (data.proof) {
    const bytes = Uint8Array.from(atob(data.proof.base64), c => c.charCodeAt(0));
    if (bytes.length > 5_000_000) throw new Error('صورة التحويل كبيرة جداً');
    proofPath = `${crypto.randomUUID()}.${data.proof.type.split('/')[1]}`;
    const { error: uploadError } = await supabaseAdmin.storage.from('payment-proofs').upload(proofPath, bytes, { contentType: data.proof.type });
    if (uploadError) throw new Error('تعذر رفع إثبات التحويل');
  }
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const eligible = items.reduce((sum, item) => sum + eligibleItemAmount(item.unit_price, item.quantity, !item.loyalty_eligible), 0);
  const loyalty = userId ? await loyaltyFor(supabaseAdmin, userId) : null;
  const loyaltyDiscount = loyaltyDiscountFor(eligible, !!loyalty?.discountActive && loyalty.monthSpend + eligible < 3000);
  const deliveryFee = Number(zone.fee);
  const total = orderTotal(subtotal, loyaltyDiscount, deliveryFee);
  const locationUrl = data.location ? `https://www.google.com/maps?q=${data.location.lat.toFixed(6)},${data.location.lng.toFixed(6)}` : null;
  const orderId = crypto.randomUUID();
  const trackingCode = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const { data: order, error } = await supabaseAdmin.from('orders').insert({ id: orderId, tracking_code: trackingCode, user_id: userId, customer_name: data.name, phone: data.phone, address: data.address, notes: data.notes, payment_method: data.paymentMethod, payment_proof_path: proofPath, total, subtotal, loyalty_discount: loyaltyDiscount, delivery_fee: deliveryFee, zone_name: zone.name, location_url: locationUrl }).select('id').single();
  if (error || !order) throw new Error('تعذر تسجيل الطلب');
  const { error: itemError } = await supabaseAdmin.from('order_items').insert(items.map(item => ({ ...item, order_id: order.id })));
  if (itemError) {
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    throw new Error('تعذر حفظ تفاصيل الطلب');
  }
  try {
    const { sendOrderToTelegram } = await import('./telegram.server');
    const payment = { cod: 'كاش عند الاستلام', instapay: 'إنستا باي', vodafone: 'فودافون كاش' }[data.paymentMethod];
    let proofUrl: string | null = null;
    if (proofPath) {
      const { data: signed } = await supabaseAdmin.storage.from('payment-proofs').createSignedUrl(proofPath, 60 * 60 * 24 * 7);
      proofUrl = signed?.signedUrl ?? null;
    }
    await sendOrderToTelegram({ id: order.id, trackingCode, name: data.name, phone: data.phone, address: data.address, notes: data.notes, payment, hasProof: !!proofPath, proofUrl, zone: zone.name, deliveryFee, subtotal, loyaltyDiscount, total, locationUrl, items: items.map(i => ({ name: i.product_name, quantity: i.quantity, price: Number(i.unit_price) })) });
  } catch (e) { console.error('Telegram notify error', e); }
  const updatedLoyalty = userId ? await loyaltyFor(supabaseAdmin, userId).catch(() => null) : null;
  return { id: order.id, total, trackingCode, loyalty: updatedLoyalty };
});

export const getTracking = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ code: z.string().trim().min(4).max(20) }).parse(input)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: o } = await supabaseAdmin.from('orders').select('tracking_code, tracking_stage, tracking_updated_at, status, created_at, zone_name, total').eq('tracking_code', data.code.toUpperCase()).maybeSingle();
  if (!o?.tracking_code) return null;
  return { code: o.tracking_code, stage: o.status === 'completed' ? 3 : Math.min(o.tracking_stage, 3), updatedAt: o.tracking_updated_at, cancelled: o.status === 'cancelled', createdAt: o.created_at, zone: o.zone_name, total: Number(o.total) };
});

export const getZones = createServerFn({ method: 'GET' }).handler(async () => {
  const { data, error } = await publicClient().from('delivery_zones').select('id, name, fee').eq('active', true).order('name');
  if (error) throw new Error('تعذر تحميل مناطق التوصيل');
  return (data ?? []).map(z => ({ ...z, fee: Number(z.fee) }));
});

export const getMyLoyalty = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  return loyaltyFor(context.supabase, context.userId);
});

export const getMyTracking = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('orders').select('tracking_code, tracking_stage, status, created_at').eq('user_id', context.userId).order('created_at', { ascending: false });
  if (error) throw new Error('تعذر تحميل طلباتك');
  return (data ?? []).flatMap(o => o.tracking_code ? [{ ...o, tracking_code: o.tracking_code }] : []);
});

export const saveRewardPhone = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ phone: z.string().trim().regex(/^01[0-9]{9}$/, 'اكتبي رقم موبايل مصري صحيح') }).parse(input)).handler(async ({ context, data }) => {
  const loyalty = await loyaltyFor(context.supabase, context.userId);
  if (loyalty.monthSpend < 3000) throw new Error('تسجيل رقم المكافأة متاح عند الوصول إلى ٣٠٠٠ جنيه');
  const { error } = await context.supabase.from('profiles').upsert({ id: context.userId, phone: data.phone });
  if (error) throw new Error('تعذر حفظ رقم الهاتف');
  const { telegramCall, ORDER_CHAT_ID } = await import('./telegram.server');
  const response = await telegramCall('sendMessage', { chat_id: ORDER_CHAT_ID, text: `🎁 طلب التواصل لاستلام مكافأة نقاطي\nرقم العميلة: ${data.phone}\nالمشتريات المؤهلة: ${loyalty.monthSpend} ج.م\nالمكافآت: ${loyalty.earnedGifts.join('، ')}` });
  if (!response) throw new Error('تم حفظ الرقم لكن تعذر إرسال طلب التواصل، حاولي مرة أخرى');
  return { ok: true };
});

export const resolveSearch = createServerFn({ method: 'POST' }).inputValidator(input => z.object({ q: z.string().max(200) }).parse(input)).handler(async ({ data }) => {
  // Keyword lives only on the server so it never ships in browser code.
  if (data.q.trim().toLowerCase() === 'eladlyadmin') return { redirect: '/eladly' };
  return { redirect: null as string | null };
});

const zoneSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(100), fee: z.number().min(0).max(100000), active: z.boolean() });
export const saveZone = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => zoneSchema.parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { id, ...fields } = data;
  const { error } = id ? await context.supabase.from('delivery_zones').update(fields).eq('id', id) : await context.supabase.from('delivery_zones').insert(fields);
  if (error) throw new Error('تعذر حفظ المنطقة'); return { ok: true };
});
export const removeZone = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { error } = await context.supabase.from('delivery_zones').delete().eq('id', data.id);
  if (error) throw new Error('تعذر حذف المنطقة'); return { ok: true };
});

export const getAdminData = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin');
  if (!allowed) throw new Error('غير مصرح لك بدخول لوحة الإدارة');
  const [products, orders, admins, zones] = await Promise.all([
    context.supabase.from('products').select('*').order('created_at', { ascending: false }),
    context.supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
    context.supabase.from('admin_emails').select('*').order('created_at', { ascending: false }),
    context.supabase.from('delivery_zones').select('*').order('name'),
  ]);
  if (products.error || orders.error || admins.error || zones.error) throw new Error('تعذر تحميل بيانات الإدارة');
  return { products: products.data ?? [], orders: orders.data ?? [], admins: admins.data ?? [], zones: (zones.data ?? []).map(z => ({ ...z, fee: Number(z.fee) })) };
});

const productSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(200), category: z.string().min(2).max(100), subcategory: z.string().max(100).nullable(), card_description: z.string().max(300), description: z.string().max(5000), image_urls: z.array(z.string().max(1000)).max(8), price: z.number().min(0).max(1000000), discount_amount: z.number().min(0).max(1000000), discount_until: z.string().nullable(), stock: z.number().int().min(0), featured: z.boolean(), active: z.boolean() }).refine(p => p.discount_amount <= p.price, 'الخصم لا يمكن أن يتجاوز السعر');
export const saveProduct = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => productSchema.parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin');
  if (!allowed) throw new Error('غير مصرح');
  const { id, ...fields } = data;
  const result = id ? await context.supabase.from('products').update(fields).eq('id', id).select().single() : await context.supabase.from('products').insert(fields).select().single();
  if (result.error) throw new Error('تعذر حفظ المنتج');
  return result.data;
});
export const removeProduct = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { error } = await context.supabase.from('products').update({ active: false }).eq('id', data.id);
  if (error) throw new Error('تعذر إخفاء المنتج'); return { ok: true };
});
export const updateOrderStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ id: z.string().uuid(), status: z.enum(['new','confirmed','completed','cancelled']) }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { error } = await context.supabase.from('orders').update({ status: data.status }).eq('id', data.id);
  if (error) throw new Error(error.message.includes('Insufficient stock') ? 'المخزون غير كافٍ لإكمال الطلب' : 'تعذر تحديث الطلب'); return { ok: true };
});
export const addAdminEmail = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ email: emailSchema }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { error } = await context.supabase.from('admin_emails').insert({ email: data.email.toLowerCase() });
  if (error) throw new Error('تعذر إضافة البريد، ربما هو موجود بالفعل'); return { ok: true };
});
export const removeAdminEmail = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ email: emailSchema }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { error } = await context.supabase.from('admin_emails').delete().eq('email', data.email);
  if (error) throw new Error('تعذر حذف البريد'); return { ok: true };
});
export const getProofUrl = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ path: z.string().min(1).max(500) }).parse(input)).handler(async ({ context, data }) => {
  const { data: allowed } = await context.supabase.rpc('is_store_admin'); if (!allowed) throw new Error('غير مصرح');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: signed, error } = await supabaseAdmin.storage.from('payment-proofs').createSignedUrl(data.path, 300);
  if (error || !signed) throw new Error('تعذر عرض الإيصال'); return { url: signed.signedUrl };
});
