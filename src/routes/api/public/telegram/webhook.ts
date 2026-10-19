import { createFileRoute } from '@tanstack/react-router';
import { parseTrackingCommand, TRACKING_STAGES } from '@/lib/tracking';

async function deriveSecret(key: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`telegram-webhook:${key}`));
  let bin = ''; new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const Route = createFileRoute('/api/public/telegram/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env['TELEGRAM_API_KEY'];
        if (!key) return new Response('Not configured', { status: 500 });
        if ((request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '') !== await deriveSecret(key)) return new Response('Unauthorized', { status: 401 });
        const update = await request.json() as any;
        const msg = update.message ?? update.edited_message;
        const { ORDER_CHAT_ID, telegramCall } = await import('@/lib/telegram.server');
        if (!msg?.text || String(msg.chat?.id) !== ORDER_CHAT_ID) return Response.json({ ok: true });
        const reply = (text: string) => telegramCall('sendMessage', { chat_id: ORDER_CHAT_ID, text, reply_to_message_id: msg.message_id });
        const cmd = parseTrackingCommand(msg.text);
        if (!cmd) {
          if (/^(\/|[1-4]\/)/.test(msg.text)) await reply('الصيغة: /1 رقم_التتبع أو 1/ رقم_التتبع\n/1 تم استلام الطلب\n/2 تم تجهيز الطلب\n/3 تم التسليم لشركة الشحن\n/4 تم الاستلام');
          return Response.json({ ok: true });
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const now = new Date().toISOString();
        const patch: { tracking_stage: number; tracking_updated_at: string; status?: string } = { tracking_stage: cmd.stage, tracking_updated_at: now };
        const { data: current } = await supabaseAdmin.from('orders').select('id, status').eq('tracking_code', cmd.code).maybeSingle();
        if (!current) { await reply(`❌ لا يوجد طلب برقم التتبع ${cmd.code}`); return Response.json({ ok: true }); }
        if (current.status === 'cancelled' || current.status === 'completed') { await reply('هذا الطلب مغلق ولا يمكن تغيير حالته'); return Response.json({ ok: true }); }
        if (cmd.stage >= 1 && current.status === 'new') patch.status = 'confirmed';
        if (cmd.stage === 3) patch.status = 'completed';
        const { error } = await supabaseAdmin.from('orders').update(patch).eq('id', current.id);
        if (error) {
          await reply(`❌ تعذر التحديث: ${error.message.includes('Insufficient') ? 'المخزون غير كافٍ' : error.message}`);
          return Response.json({ ok: true });
        }
        await reply(`✅ الطلب ${cmd.code}: ${TRACKING_STAGES[cmd.stage]}`);
        return Response.json({ ok: true });
      },
    },
  },
});
