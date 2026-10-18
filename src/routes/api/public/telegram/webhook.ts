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
          if (msg.text.startsWith('/')) await reply('الصيغة: /1 رقم_التتبع\n/1 جاري التجهيز\n/2 تم التسليم لشركة الشحن\n/3 مع المندوب\n/4 تم التسليم');
          return Response.json({ ok: true });
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const patch: Record<string, unknown> = { tracking_stage: cmd.stage, tracking_updated_at: new Date().toISOString() };
        const { data: current } = await supabaseAdmin.from('orders').select('id, status').eq('tracking_code', cmd.code).maybeSingle();
        if (!current) { await reply(`❌ لا يوجد طلب برقم التتبع ${cmd.code}`); return Response.json({ ok: true }); }
        if (cmd.stage >= 1 && current.status === 'new') patch.status = 'confirmed';
        if (cmd.stage === 4 && current.status !== 'completed') patch.status = 'completed';
        const { error } = await supabaseAdmin.from('orders').update(patch).eq('id', current.id);
        if (error) {
          const { error: e2 } = await supabaseAdmin.from('orders').update({ tracking_stage: cmd.stage, tracking_updated_at: patch.tracking_updated_at as string }).eq('id', current.id);
          await reply(e2 ? `❌ تعذر التحديث: ${e2.message}` : `⚠️ تم تحديث التتبع لـ "${TRACKING_STAGES[cmd.stage]}" لكن تعذر إكمال الطلب (${error.message.includes('Insufficient') ? 'المخزون غير كافٍ' : error.message})`);
          return Response.json({ ok: true });
        }
        await reply(`✅ الطلب ${cmd.code}: ${TRACKING_STAGES[cmd.stage]}`);
        return Response.json({ ok: true });
      },
    },
  },
});
