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
