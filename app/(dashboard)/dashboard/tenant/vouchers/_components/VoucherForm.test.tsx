// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.mock('../_actions/voucherActions', () => ({
  createTenantVoucher: vi.fn(),
  updateTenantVoucher: vi.fn(),
}));
import { VoucherForm } from './VoucherForm';
import { voucherLocalDateTime } from '../_lib/datetime';
import type { TenantVoucher } from '../_lib/schema';
afterEach(cleanup);
const saved: TenantVoucher = {
  id: '9b9ee145-f561-4acb-b231-6d22d076369c',
  code: 'SAVED',
  discount_type: 'percentage',
  discount_value: 10,
  min_transaction_amount: 0,
  current_uses: 0,
  is_active: true,
  created_at: '',
  updated_at: '',
  valid_from: '2026-12-31T21:23:45.123Z',
  valid_until: '2027-01-02T02:34:56Z',
};
const payload = (container: HTMLElement) =>
  new FormData(container.querySelector('form')!);

it('leaves dates empty until selected, then submits full local day boundaries as ISO', () => {
  const { container } = render(<VoucherForm />);
  expect(payload(container).get('valid_from')).toBe('');
  expect(payload(container).get('valid_until')).toBe('');
  fireEvent.change(screen.getByLabelText('Valid from date'), {
    target: { value: '2026-12-31' },
  });
  fireEvent.change(screen.getByLabelText('Valid until date'), {
    target: { value: '2026-12-31' },
  });
  expect(
    (screen.getByLabelText('Valid from time') as HTMLInputElement).value,
  ).toBe('00:00:00');
  expect(
    (screen.getByLabelText('Valid until time') as HTMLInputElement).value,
  ).toBe('23:59:59');
  expect(payload(container).get('valid_from')).toBe(
    new Date('2026-12-31T00:00:00').toISOString(),
  );
  expect(payload(container).get('valid_until')).toBe(
    new Date('2026-12-31T23:59:59').toISOString(),
  );
});

it('keeps intentionally changed time when the date changes or is cleared and reselected', () => {
  const { container } = render(<VoucherForm />);
  const date = screen.getByLabelText('Valid until date'),
    time = screen.getByLabelText('Valid until time');
  fireEvent.change(date, { target: { value: '2026-10-31' } });
  fireEvent.change(time, { target: { value: '18:17:16' } });
  fireEvent.change(date, { target: { value: '2026-11-01' } });
  expect(payload(container).get('valid_until')).toBe(
    new Date('2026-11-01T18:17:16').toISOString(),
  );
  fireEvent.change(date, { target: { value: '' } });
  expect(payload(container).get('valid_until')).toBe('');
  fireEvent.change(date, { target: { value: '2027-01-01' } });
  expect((time as HTMLInputElement).value).toBe('18:17:16');
});

it('preserves exact stored instants on untouched edit and local time/seconds on date-only edits', () => {
  const { container } = render(<VoucherForm voucher={saved} />);
  expect(payload(container).get('valid_from')).toBe(saved.valid_from);
  expect(payload(container).get('valid_until')).toBe(saved.valid_until);
  const local = voucherLocalDateTime(saved.valid_from);
  expect(
    (screen.getByLabelText('Valid from date') as HTMLInputElement).value,
  ).toBe(local.date.slice(8, 10));
  expect(
    (screen.getByLabelText('Valid from time') as HTMLInputElement).value,
  ).toBe(local.time);
  fireEvent.change(screen.getByLabelText('Valid from date'), {
    target: { value: '2027-01-03' },
  });
  expect(payload(container).get('valid_from')).toBe(
    new Date(`2027-01-03T${local.time}`).toISOString(),
  );
  expect(payload(container).get('valid_until')).toBe(saved.valid_until);
});

it('requires a time once a date is set and keeps incomplete input invalid for action validation', () => {
  const { container } = render(<VoucherForm />);
  fireEvent.change(screen.getByLabelText('Valid from date'), {
    target: { value: '2026-10-16' },
  });
  const time = screen.getByLabelText('Valid from time') as HTMLInputElement;
  fireEvent.change(time, { target: { value: '' } });
  expect(time.checkValidity()).toBe(false);
  expect(payload(container).get('valid_from')).toBe('2026-10-16T');
});

it('retains chosen dates and seconds and associates server range errors after failed save', async () => {
  const { createTenantVoucher } = await import('../_actions/voucherActions');
  vi.mocked(createTenantVoucher).mockResolvedValueOnce({
    success: false,
    message: 'Check dates',
    errors: { valid_until: ['Valid-until must be on or after valid-from.'] },
  });
  const { container } = render(<VoucherForm />);
  fireEvent.change(screen.getByLabelText(/Code/), {
    target: { value: 'DATES' },
  });
  fireEvent.change(screen.getByLabelText(/Discount value/), {
    target: { value: '10' },
  });
  fireEvent.change(screen.getByLabelText('Valid from date'), {
    target: { value: '2026-12-31' },
  });
  fireEvent.change(screen.getByLabelText('Valid until date'), {
    target: { value: '2026-12-30' },
  });
  fireEvent.submit(container.querySelector('form')!);
  await screen.findByText('Valid-until must be on or after valid-from.');
  const control = screen.getByLabelText('Valid until time') as HTMLInputElement;
  expect(control.value).toBe('23:59:59');
  expect(control.getAttribute('aria-invalid')).toBe('true');
  expect(
    control
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' '),
  ).toContain('Valid-until must be on or after valid-from.');
});
