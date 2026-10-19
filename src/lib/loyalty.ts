// Loyalty program "نقاطي": only full-price (non-discounted) items count; discounts never stack.
export const LOYALTY_DISCOUNT_THRESHOLD = 1000;
export const LOYALTY_DISCOUNT_RATE = 0.03;
export const LOYALTY_GIFTS = [
  { amount: 3000, gift: 'بيبي ليس أو سشوار' },
  { amount: 5000, gift: 'فرشاة شعر كهربائية' },
  { amount: 7000, gift: 'سشوار احترافي' },
] as const;

export type LoyaltyOrder = { created_at: string; eligible_amount: number };

const monthKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(d);

export function eligibleItemAmount(price: number, quantity: number, discounted: boolean) {
  return discounted ? 0 : price * quantity;
}

export function loyaltyStatus(orders: LoyaltyOrder[], now = new Date()) {
  const currentKey = monthKey(now);
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const previousKey = monthKey(new Date(Date.UTC(year, month - 2, 15)));
  const spendFor = (key: string) => orders.filter(o => monthKey(new Date(o.created_at)) === key).reduce((s, o) => s + o.eligible_amount, 0);
  const monthSpend = spendFor(currentKey);
  const previousMonthSpend = spendFor(previousKey);
  const giftThreshold = LOYALTY_GIFTS[0].amount;
  const discountCancelled = monthSpend >= giftThreshold;
  const discountActive = previousMonthSpend >= LOYALTY_DISCOUNT_THRESHOLD && previousMonthSpend < giftThreshold && !discountCancelled;
  const nextMonthDiscount = monthSpend >= LOYALTY_DISCOUNT_THRESHOLD && !discountCancelled;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  // Find Cairo midnight from the displayed local hour, including daylight-saving time.
  const localHour = Number(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }).format(nextMonth));
  const discountUntil = new Date(nextMonth.getTime() - localHour * 3600000);
  const nextGift = LOYALTY_GIFTS.find(g => monthSpend < g.amount) ?? null;
  const earnedGifts = LOYALTY_GIFTS.filter(g => monthSpend >= g.amount).map(g => g.gift);
  return {
    monthSpend,
    discountActive,
    previousMonthSpend,
    discountCancelled,
    nextMonthDiscount,
    nextMonthLabel: nextMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }),
    discountUntil: discountActive ? discountUntil.toISOString() : null,
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
