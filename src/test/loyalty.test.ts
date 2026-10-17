import { describe, expect, it } from 'vitest';
import { loyaltyDiscountFor, loyaltyStatus, orderTotal } from '@/lib/loyalty';

describe('loyalty program', () => {
  it('total = discounted subtotal + zone fee (100 + 20 = 120)', () => {
    expect(orderTotal(100, 0, 20)).toBe(120);
  });
  it('unlocks 3% once eligible spend reaches 1000 in a month', () => {
    const s = loyaltyStatus([{ created_at: '2026-10-02T10:00:00Z', eligible_amount: 600 }, { created_at: '2026-10-05T10:00:00Z', eligible_amount: 400 }], new Date('2026-10-10T00:00:00Z'));
    expect(s.discountActive).toBe(true);
    expect(loyaltyDiscountFor(200, s.discountActive)).toBe(6);
  });
  it('3% lasts exactly 30 days from unlock', () => {
    const orders = [{ created_at: '2026-10-01T00:00:00Z', eligible_amount: 1000 }];
    expect(loyaltyStatus(orders, new Date('2026-10-30T23:00:00Z')).discountActive).toBe(true);
    expect(loyaltyStatus(orders, new Date('2026-10-31T00:00:01Z')).discountActive).toBe(false);
  });
  it('999 does not unlock the discount', () => {
    expect(loyaltyStatus([{ created_at: '2026-10-01T00:00:00Z', eligible_amount: 999 }], new Date('2026-10-02T00:00:00Z')).discountActive).toBe(false);
  });
  it('monthly gifts at 3000 / 5000 / 7000', () => {
    const s = loyaltyStatus([{ created_at: '2026-10-01T00:00:00Z', eligible_amount: 5200 }], new Date('2026-10-03T00:00:00Z'));
    expect(s.earnedGifts).toEqual(['بيبي ليس أو سشوار', 'فرشاة شعر كهربائية']);
    expect(s.nextGift?.amount).toBe(7000);
    expect(s.nextGift?.remaining).toBe(1800);
  });
});
