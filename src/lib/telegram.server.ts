const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
export const ORDER_CHAT_ID = '8367274841';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type TelegramOrder = {
  id: string; trackingCode: string; name: string; phone: string; address: string; notes: string; payment: string; hasProof: boolean; proofUrl: string | null;
  zone: string; deliveryFee: number; subtotal: number; loyaltyDiscount: number; total: number; locationUrl: string | null;
  items: { name: string; quantity: number; price: number }[];
};

export async function telegramCall(method: string, body: Record<string, unknown>) {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connKey = process.env['TELEGRAM_API_KEY'];
  let res: Response;
  if (lovableKey && connKey) {
    res = await fetch(`${GATEWAY_URL}/${method}`, { method: 'POST', headers: { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': connKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } else {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    if (!token) { console.error('Telegram not configured'); return null; }
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  if (!res.ok) throw new Error(`Telegram ${method} failed [${res.status}]: ${await res.text()}`);
  const payload = await res.clone().json() as { ok?: boolean; description?: string };
  if (payload.ok === false) throw new Error(`Telegram ${method} failed [${res.status}]: ${payload.description}`);
  return res;
}

export async function sendOrderToTelegram(o: TelegramOrder) {
  const addressMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address} ${o.zone}`)}`;
  const lines = [
    `🛒 <b>طلب جديد</b>`,
    `🔖 رقم التتبع: <code>${o.trackingCode}</code>`,
    `🕒 ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`,
    '',
    `👤 الاسم: ${esc(o.name)}`,
    `📞 الهاتف: <a href="tel:${o.phone}">${o.phone}</a>`,
    `🏙️ المنطقة: ${esc(o.zone)}`,
    `📍 العنوان: ${esc(o.address)}`,
    `🔗 <a href="${addressMap}">العنوان على خرائط جوجل</a>`,
    o.locationUrl ? `🗺️ <a href="${o.locationUrl}">الموقع الدقيق للعميل (GPS)</a>` : '🗺️ لم يحدد موقع GPS دقيق',
    o.notes ? `📝 ملاحظات: ${esc(o.notes)}` : '',
    '',
    '<b>المنتجات:</b>',
    ...o.items.map(i => `• ${esc(i.name)} × ${i.quantity} — ${i.price} ج.م للقطعة = ${i.price * i.quantity} ج.م`),
    '',
    `المنتجات: ${o.subtotal} ج.م`,
    o.loyaltyDiscount > 0 ? `خصم نقاطي 3%: -${o.loyaltyDiscount} ج.م` : '',
    `التوصيل: ${o.deliveryFee} ج.م`,
    `💰 <b>الإجمالي: ${o.total} ج.م</b>`,
    `💳 الدفع: ${o.payment}${o.hasProof ? ' (الإيصال مرفق بالأسفل ✅)' : ''}`,
    '',
    '<b>تحديث الحالة:</b>',
    `/1 ${o.trackingCode} — تم استلام الطلب`,
    `/2 ${o.trackingCode} — تم تجهيز الطلب`,
    `/3 ${o.trackingCode} — تم التسليم لشركة الشحن`,
    `/4 ${o.trackingCode} — تم الاستلام`,
  ].filter(l => l !== '');
  await telegramCall('sendMessage', { chat_id: ORDER_CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true });
  await telegramCall('sendMessage', { chat_id: ORDER_CHAT_ID, text: o.trackingCode });
  if (o.proofUrl) {
    await telegramCall('sendPhoto', { chat_id: ORDER_CHAT_ID, photo: o.proofUrl, caption: `🧾 إيصال التحويل — طلب ${o.trackingCode}\n${o.name} — ${o.total} ج.م` });
  }
}
