// Loyalty program "نقاطي": only full-price (non-discounted) items count; discounts never stack.
export const LOYALTY_DISCOUNT_THRESHOLD = 1000;
export const LOYALTY_DISCOUNT_RATE = 0.03;
export const LOYALTY_DISCOUNT_DAYS = 30;
export const LOYALTY_GIFTS = [
  { amount: 3000, gift: 'بيبي ليس أو سشوار' },
  { amount: 5000, gift: 'فرشاة شعر كهربائية' },
  { amount: 7000, gift: 'سشوار احترافي' },
] as const;

export type LoyaltyOrder = { created_at: string; eligible_amount: number };

const DAY = 86_400_000;
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

export function loyaltyStatus(orders: LoyaltyOrder[], now = new Date()) {
  const sorted = [...orders].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  let unlockedAt: Date | null = null;
  let running = 0;
  let key = '';
  for (const order of sorted) {
    const at = new Date(order.created_at);
    if (monthKey(at) !== key) { key = monthKey(at); running = 0; }
    const before = running;
    running += order.eligible_amount;
    if (before < LOYALTY_DISCOUNT_THRESHOLD && running >= LOYALTY_DISCOUNT_THRESHOLD) unlockedAt = at;
  }
  const currentKey = monthKey(now);
  const monthSpend = sorted.filter(o => monthKey(new Date(o.created_at)) === currentKey).reduce((s, o) => s + o.eligible_amount, 0);
  const discountUntil = unlockedAt ? new Date(unlockedAt.getTime() + LOYALTY_DISCOUNT_DAYS * DAY) : null;
  const discountActive = !!discountUntil && discountUntil.getTime() > now.getTime();
  const nextGift = LOYALTY_GIFTS.find(g => monthSpend < g.amount) ?? null;
  const earnedGifts = LOYALTY_GIFTS.filter(g => monthSpend >= g.amount).map(g => g.gift);
  return {
    monthSpend,
    discountActive,
    discountUntil: discountActive ? discountUntil!.toISOString() : null,
    remainingForDiscount: Math.max(0, LOYALTY_DISCOUNT_THRESHOLD - monthSpend),
    nextGift: nextGift ? { ...nextGift, remaining: nextGift.amount - monthSpend } : null,
    earnedGifts,
  };
}

/** 3% applies only to the full-price (eligible) part of the order. */
export function loyaltyDiscountFor(eligibleSubtotal: number, active: boolean) {
  return active ? Math.round(eligibleSubtotal * LOYALTY_DISCOUNT_RATE * 100) / 100 : 0;
}

export function orderTotal(subtotal: number, loyaltyDiscount: number, deliveryFee: number) {
  return Math.max(0, subtotal - loyaltyDiscount) + deliveryFee;
}
