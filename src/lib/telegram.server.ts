const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const ORDER_CHAT_ID = '8367274841';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type TelegramOrder = {
  id: string; name: string; phone: string; address: string; notes: string; payment: string; hasProof: boolean;
  zone: string; deliveryFee: number; subtotal: number; loyaltyDiscount: number; total: number; locationUrl: string | null;
  items: { name: string; quantity: number; price: number }[];
};

export async function sendOrderToTelegram(o: TelegramOrder) {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connKey = process.env['TELEGRAM_API_KEY'];
  const lines = [
    `🛒 <b>طلب جديد #${o.id.slice(0, 8).toUpperCase()}</b>`,
    `🕒 ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`,
    '',
    `👤 ${esc(o.name)}`,
    `📞 <a href="tel:${o.phone}">${o.phone}</a>`,
    `🏙️ المنطقة: ${esc(o.zone)}`,
    `📍 العنوان: ${esc(o.address)}`,
    o.locationUrl ? `🗺️ <a href="${o.locationUrl}">فتح اللوكيشن على خرائط جوجل</a>` : '🗺️ لم يحدد موقع دقيق',
    o.notes ? `📝 ملاحظات: ${esc(o.notes)}` : '',
    '',
    '<b>المنتجات:</b>',
    ...o.items.map(i => `• ${esc(i.name)} × ${i.quantity} — ${i.price * i.quantity} ج.م`),
    '',
    `المنتجات: ${o.subtotal} ج.م`,
    o.loyaltyDiscount > 0 ? `خصم نقاطي 3%: -${o.loyaltyDiscount} ج.م` : '',
    `التوصيل: ${o.deliveryFee} ج.م`,
    `💰 <b>الإجمالي: ${o.total} ج.م</b>`,
    `💳 الدفع: ${o.payment}${o.hasProof ? ' (تم رفع صورة الإيصال ✅)' : ''}`,
  ].filter(l => l !== '');
  const text = lines.join('\n');
  let res: Response;
  if (lovableKey && connKey) {
    res = await fetch(`${GATEWAY_URL}/sendMessage`, { method: 'POST', headers: { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': connKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ORDER_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  } else {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    if (!token) { console.error('Telegram not configured'); return; }
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ORDER_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  }
  if (!res.ok) console.error(`Telegram send failed [${res.status}]: ${await res.text()}`);
}
