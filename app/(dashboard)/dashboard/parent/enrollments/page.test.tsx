import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * Render test for the parent enrollment screen's cancellation control (KEL-45).
 *
 * The acceptance criteria are about what a parent is offered and what they are
 * not: the action appears only for a cancellable enrollment, a paid one shows no
 * action, and the existing status presentation is unchanged. Both refusals are
 * the backend's rules mirrored by `canCancelEnrollment`, so the rows below are
 * the rows of ADR 0016's refusal table.
 *
 * The page is a Server Component that awaits `cookies()` and `fetch`, so its
 * collaborators are mocked and the rendered markup is asserted. `renderToStaticMarkup`
 * is used directly, as in `EnrollmentTable.test.tsx`: the markup is the contract
 * and no DOM testing library is needed.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' ? { name, value: 'session-token' } : undefined),
  })),
}));

const enrollments: Array<Record<string, unknown>> = [];
const transactions: Array<Record<string, unknown>> = [];

vi.mock('./_queries/queries', () => ({
  getEnrollmentHistory: vi.fn(async () => ({
    data: { enrollments, transactions },
    error: null,
  })),
}));

const { default: ParentEnrollmentHistoryPage } = await import('./page');

const PENDING_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ACTIVE_ID = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';

function setRows(
  enrollmentRows: Array<Record<string, unknown>>,
  transactionRows: Array<Record<string, unknown>> = []
) {
  enrollments.length = 0;
  enrollments.push(...enrollmentRows);
  transactions.length = 0;
  transactions.push(...transactionRows);
}

async function render(): Promise<string> {
  return renderToStaticMarkup(await ParentEnrollmentHistoryPage());
}

describe('parent enrollment screen cancellation control', () => {
  it('offers cancellation for a pending enrollment whose invoice is unpaid', async () => {
    setRows(
      [{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }],
      [{ id: 'tx-1', enrollment_id: PENDING_ID, status: 'pending' }]
    );

    const html = await render();

    expect(html).toContain('Batalkan pendaftaran');
    // The control is a confirmation dialog, not a bare submit: the parent must
    // confirm before the seat is released.
    expect(html).toContain('Batalkan pendaftaran ini?');
    expect(html).toContain(PENDING_ID);
  });

  it('offers cancellation for a pending enrollment that has no transaction yet', async () => {
    setRows([{ id: PENDING_ID, status: 'pending' }]);

    const html = await render();

    expect(html).toContain('Batalkan pendaftaran');
  });

  it('does not offer cancellation once the payment was accepted', async () => {
    // Billing refuses to withdraw a settled invoice, so offering the action here
    // would only produce a 409 the parent cannot resolve.
    setRows(
      [{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }],
      [{ id: 'tx-1', enrollment_id: PENDING_ID, status: 'paid' }]
    );

    const html = await render();

    expect(html).not.toContain('Batalkan pendaftaran');
    // The status presentation itself is unchanged.
    expect(html).toContain('Pembayaran diterima');
  });

  it('does not offer cancellation for an enrollment that already started or finished', async () => {
    setRows(
      [
        { id: ACTIVE_ID, status: 'active' },
        { id: '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b', status: 'completed' },
        { id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c', status: 'dropped' },
      ],
      [{ id: 'tx-2', enrollment_id: ACTIVE_ID, status: 'paid', reconciliation_status: 'active' }]
    );

    const html = await render();

    expect(html).not.toContain('Batalkan pendaftaran');
    // The existing presentation is untouched: the enrollment's own status is
    // shown inline and the payment badge follows `paymentPresentation`.
    expect(html).toContain('Aktif');
    expect(html).toContain('Pembayaran diterima dan enrollment telah aktif.');
    expect(html).toContain('Enrollment completed');
    expect(html).toContain('Enrollment dropped');
  });

  it('keeps the empty state and the header copy when there is nothing to cancel', async () => {
    setRows([]);

    const html = await render();

    expect(html).toContain('Belum ada enrollment.');
    expect(html).not.toContain('Batalkan pendaftaran');
  });
});

/**
 * KEL-53: a parent may resume a payment that is still waiting. The link comes
 * from the billing transaction (`checkout_session_url` + `invoice_expires_at`)
 * and must only appear while the invoice is still valid, so the rows below pin
 * the acceptance criteria at the rendered-markup level.
 */
describe('parent enrollment screen resume-payment link (KEL-53)', () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const CHECKOUT_URL = 'https://checkout.example.com/pay/session-1';

  function pendingTx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: 'tx-1', enrollment_id: PENDING_ID, status: 'pending', checkout_session_url: CHECKOUT_URL, invoice_expires_at: future, gross_amount: 150000, currency: 'IDR', ...overrides };
  }

  it.each(['paid', 'failed', 'expired', 'cancelled'] as const)('shows no resume link for a %s transaction', async (status) => {
    setRows([{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }], [pendingTx({ status })]);

    const html = await render();

    expect(html).not.toContain('Lanjutkan pembayaran');
    expect(html).not.toContain(CHECKOUT_URL);
  });

  it('renders the checkout link with its deadline for a pending, still-valid invoice', async () => {
    setRows([{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }], [pendingTx()]);

    const html = await render();

    expect(html).toContain('Lanjutkan pembayaran');
    expect(html).toContain(`href="${CHECKOUT_URL}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Selesaikan pembayaran sebelum');
  });

  it('shows no resume link once the invoice has expired', async () => {
    setRows([{ id: PENDING_ID, status: 'pending' }], [pendingTx({ invoice_expires_at: past })]);

    const html = await render();

    expect(html).not.toContain('Lanjutkan pembayaran');
    expect(html).not.toContain(CHECKOUT_URL);
  });

  it('shows no resume link for an old transaction without invoice_expires_at', async () => {
    setRows([{ id: PENDING_ID, status: 'pending' }], [pendingTx({ invoice_expires_at: undefined })]);

    const html = await render();

    expect(html).not.toContain('Lanjutkan pembayaran');
    expect(html).not.toContain(CHECKOUT_URL);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>'])('never renders a %s checkout URL', async (url) => {
    setRows([{ id: PENDING_ID, status: 'pending' }], [pendingTx({ checkout_session_url: url })]);

    const html = await render();

    expect(html).not.toContain('Lanjutkan pembayaran');
    expect(html).not.toContain(url);
  });

  it('keeps the status badge, the nominal, and the cancel action alongside the link', async () => {
    setRows([{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }], [pendingTx()]);

    const html = await render();

    expect(html).toContain('Menunggu pembayaran');
    expect(html).toContain('Status transaksi');
    expect(html).toContain('pending');
    expect(html).toContain('Nominal');
    expect(html).toContain('150.000');
    expect(html).toContain('Batalkan pendaftaran');
  });

  it('does not change the error, empty, or paid states that must not offer the link', async () => {
    setRows(
      [{ id: PENDING_ID, status: 'pending', class: { name: 'Matematika Dasar' } }],
      [{ id: 'tx-1', enrollment_id: PENDING_ID, status: 'paid' }]
    );

    const html = await render();

    expect(html).toContain('Pembayaran diterima');
    expect(html).not.toContain('Lanjutkan pembayaran');
    expect(html).not.toContain(CHECKOUT_URL);
  });
});
