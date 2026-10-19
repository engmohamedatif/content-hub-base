export const TRACKING_STAGES = ['تم استلام الطلب', 'تم تجهيز الطلب', 'تم التسليم لشركة الشحن', 'تم الاستلام'] as const;

/** Parses bot commands like "/2 AB12CD34" → { stage: 2, code }. */
export function parseTrackingCommand(text: string): { stage: number; code: string } | null {
  const m = text.trim().match(/^(?:\/([1-4])(?:@\w+)?|([1-4])\/)\s+([A-Za-z0-9]{4,20})\s*$/);
  if (!m?.[3]) return null;
  return { stage: Number(m[1] ?? m[2]) - 1, code: m[3].toUpperCase() };
}

const RECENT_KEY = 'prestige-recent-tracking';
export function getRecentTrackingCodes(): string[] {
  try { const codes: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string' && /^[A-Z0-9]{4,20}$/.test(c)).slice(0, 5) : []; } catch { return []; }
}
export function saveTrackingCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(normalized)) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([normalized, ...getRecentTrackingCodes().filter(c => c !== normalized)].slice(0, 5))); } catch { /* Tracking remains available when browser storage is disabled. */ }
}
