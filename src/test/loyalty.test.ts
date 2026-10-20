import { describe, expect, it } from 'vitest';
import { eligibleItemAmount, loyaltyDiscountFor, loyaltyStatus, orderTotal } from '@/lib/loyalty';

const purchase = (amount: number, at = '2026-11-15T10:00:00Z') => ({ created_at: at, eligible_amount: amount });
describe('monthly loyalty rules', () => {
  it('November 1000 earns 3% throughout December, not November', () => {
    const orders = [purchase(1000)];
    expect(loyaltyStatus(orders, new Date('2026-11-30T20:00:00Z')).discountActive).toBe(false);
    expect(loyaltyStatus(orders, new Date('2026-12-01T00:00:00Z')).discountActive).toBe(true);
    expect(loyaltyStatus(orders, new Date('2026-12-31T21:59:59Z')).discountActive).toBe(true);
    expect(loyaltyStatus(orders, new Date('2026-12-31T22:00:00Z')).discountActive).toBe(false);
  });
  it('999 does not earn a discount', () => expect(loyaltyStatus([purchase(999)], new Date('2026-12-15')).discountActive).toBe(false));
  it('2999 earns a discount but 3000 replaces it with gifts', () => {
    expect(loyaltyStatus([purchase(2999)], new Date('2026-12-15')).discountActive).toBe(true);
    expect(loyaltyStatus([purchase(3000)], new Date('2026-12-15')).discountActive).toBe(false);
  });
  it('reaching 3000 in the current month cancels an active 3% benefit', () => {
    const status = loyaltyStatus([purchase(1000), purchase(3000, '2026-12-02T12:00:00Z')], new Date('2026-12-03'));
    expect(status.discountActive).toBe(false);
    expect(status.nextMonthDiscount).toBe(false);
    expect(status.earnedGifts).toEqual(['بيبي ليس أو سشوار']);
  });
  it('500 minus 100 sale item contributes zero, not 400, to every threshold', () => {
    expect(eligibleItemAmount(400, 1, true)).toBe(0);
    expect(eligibleItemAmount(500, 2, false)).toBe(1000);
  });
  it('only eligible subtotal receives 3%, shipping is added afterward', () => {
    expect(loyaltyDiscountFor(200, true)).toBe(6);
    expect(orderTotal(600, 6, 20)).toBe(614);
  });
  it('gifts unlock at 3000, 5000 and 7000', () => {
    expect(loyaltyStatus([purchase(3000)], new Date('2026-11-20')).earnedGifts).toHaveLength(1);
    expect(loyaltyStatus([purchase(5000)], new Date('2026-11-20')).earnedGifts).toHaveLength(2);
    expect(loyaltyStatus([purchase(7000)], new Date('2026-11-20')).earnedGifts).toHaveLength(3);
  });
  it('December spending earns January discount across year rollover', () => expect(loyaltyStatus([purchase(1000, '2026-12-15T10:00:00Z')], new Date('2027-01-31T12:00:00Z')).discountActive).toBe(true));
  it('assigns orders to Cairo local month at midnight', () => expect(loyaltyStatus([purchase(1000, '2026-11-30T22:00:00Z')], new Date('2026-12-01T12:00:00Z')).monthSpend).toBe(1000));
});