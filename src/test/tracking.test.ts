import { describe, it, expect } from 'vitest';
import { parseTrackingCommand, saveTrackingCode, getRecentTrackingCodes } from '@/lib/tracking';
describe('shipment tracking', () => {
  it.each([1, 2, 3, 4])('maps command %i to its four-stage index in both slash formats', command => {
    expect(parseTrackingCommand(`/${command} ab12cd34`)).toEqual({ stage: command - 1, code: 'AB12CD34' });
    expect(parseTrackingCommand(`${command}/ ab12cd34`)).toEqual({ stage: command - 1, code: 'AB12CD34' });
  });
  it('rejects commands outside the four stages', () => expect(parseTrackingCommand('/5 AB12CD34')).toBeNull());
  it('remembers five unique recent codes', () => {
    localStorage.clear();
    for (const c of ['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE', 'FFFF', 'AAAA']) saveTrackingCode(c);
    expect(getRecentTrackingCodes()).toEqual(['AAAA', 'FFFF', 'EEEE', 'DDDD', 'CCCC']);
  });
});