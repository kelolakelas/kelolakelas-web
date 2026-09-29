// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentInstructionsPanel } from './PaymentInstructionsPanel';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('hides a VA instruction when its backend deadline passes without a page refresh', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  render(<PaymentInstructionsPanel
    instructions={{ kind: 'va', channelLabel: 'Virtual Account', vaNumber: '88001234', expiresLabel: '1 Jan 2030' }}
    expiresAt="2030-01-01T00:00:05Z"
  />);
  expect(screen.getByTestId('va-number').textContent).toBe('88001234');
  act(() => vi.advanceTimersByTime(5_001));
  expect(screen.queryByTestId('va-number')).toBeNull();
  expect(screen.getByText(/Instruksi pembayaran belum tersedia/)).toBeTruthy();
});
