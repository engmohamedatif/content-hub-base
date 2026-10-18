export const TRACKING_STAGES = ['تم استلام الطلب', 'جاري التجهيز', 'تم التسليم لشركة الشحن', 'مع المندوب', 'تم التسليم'] as const;

/** Parses bot commands like "/2 AB12CD34" → { stage: 2, code }. */
export function parseTrackingCommand(text: string): { stage: number; code: string } | null {
  const m = text.trim().match(/^\/([1-4])(?:@\w+)?\s+([A-Za-z0-9]{4,20})\s*$/);
  if (!m) return null;
  return { stage: Number(m[1]), code: m[2]!.toUpperCase() };
}
