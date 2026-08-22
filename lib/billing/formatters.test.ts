import { describe, expect, it } from 'vitest';
import { formatTransactionAmount, formatTransactionDate, getTransactionStatus } from './formatters';

describe('billing formatters', () => {
  it('formats amount and Indonesian date without empty values', () => {
    expect(formatTransactionAmount(250000)).toContain('250.000');
    expect(formatTransactionDate('2026-08-20T10:30:00Z')).not.toBe('Belum tersedia');
    expect(formatTransactionDate()).toBe('Belum tersedia');
  });

  it.each([['success', 'paid'], ['pending', 'pending'], ['failed', 'failed'], ['canceled', 'canceled']])('normalizes %s status', (value, expected) => {
    expect(getTransactionStatus(value)).toBe(expected);
  });
});