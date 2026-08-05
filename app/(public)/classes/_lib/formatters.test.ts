import { describe, expect, it } from 'vitest';
import { formatDistance, formatPrice } from './formatters';

describe('catalog formatters', () => {
  it('formats integer IDR prices without decimals', () => {
    expect(formatPrice(250000)).toContain('250.000');
  });

  it('formats distance in meters or concise kilometers', () => {
    expect(formatDistance(0.45)).toBe('450 m');
    expect(formatDistance(2.456)).toBe('2,46 km');
    expect(formatDistance(null)).toBeNull();
  });
});