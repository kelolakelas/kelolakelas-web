import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EnrollmentTable } from './EnrollmentTable';
import type { TenantEnrollmentRow } from '../_queries/queries';

/**
 * Render test for the tenant enrollment table (KEL-33).
 *
 * The acceptance criterion is that a tenant sees the enrollment together with
 * the payment status that matches the backend, so this test renders the table
 * from the exact payload shapes the services emit and asserts the visible text.
 *
 * `renderToStaticMarkup` is used directly instead of a DOM testing library: the
 * component is a Server Component with no state, so the rendered markup is the
 * whole contract and no extra test dependency is needed. Both layout branches
 * are asserted because the component renders the cards and the table into the
 * same document, with CSS deciding which one a visitor sees.
 */

const ENROLLMENT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function render(rows: TenantEnrollmentRow[], isFiltered = false): string {
  return renderToStaticMarkup(<EnrollmentTable rows={rows} isFiltered={isFiltered} />);
}

describe('EnrollmentTable', () => {
  it('shows the student, class, schedule, and both statuses', () => {
    const html = render([
      {
        enrollment: {
          id: ENROLLMENT_ID,
          status: 'active',
          joined_at: '2026-09-01T04:00:00Z',
          billing_cycle: 'monthly',
          // The academic service serialises the last name under this key.
          student: { first_name: 'Ayu', ['lastå_name']: 'Lestari' },
          class: { id: 'class-1', name: 'Matematika Dasar' },
        },
        schedule: {
          id: 'schedule-1',
          day_of_week: 3,
          start_time: '15:30:00',
          end_time: '17:00:00',
        },
        transaction: {
          id: 'tx-1',
          enrollment_id: ENROLLMENT_ID,
          status: 'paid',
          gross_amount: 1500000,
        },
      },
    ]);

    expect(html).toContain('Ayu Lestari');
    expect(html).toContain('Matematika Dasar');
    expect(html).toContain('Rabu, 15:30–17:00');
    expect(html).toContain('Aktif');
    expect(html).toContain('1.500.000');
  });

  it('renders both the card and the table layout from the same rows', () => {
    const html = render([
      { enrollment: { id: ENROLLMENT_ID, status: 'pending' } },
    ]);

    expect(html).toContain('md:hidden');
    expect(html).toContain('hidden md:block');
    expect(html).toContain('<table');
    // The table must be described for assistive technology.
    expect(html).toContain('Daftar enrollment tenant');
  });

  it('explains an enrollment that has no transaction yet', () => {
    // The seat is created before billing runs, so invoice creation can fail and
    // leave an enrollment with nothing to show. That must read as a state, not
    // as a missing value.
    const html = render([{ enrollment: { id: ENROLLMENT_ID, status: 'pending' } }]);

    expect(html).toContain('Menunggu transaksi');
    expect(html).toContain('Nominal belum tersedia');
  });

  it('surfaces a paid transaction whose activation failed', () => {
    const html = render([
      {
        enrollment: { id: ENROLLMENT_ID, status: 'pending' },
        transaction: {
          id: 'tx-1',
          enrollment_id: ENROLLMENT_ID,
          status: 'paid',
          reconciliation_status: 'terminal_failed',
          gross_amount: 250000,
        },
      },
    ]);

    expect(html).toContain('Aktivasi perlu tindak lanjut');
  });

  it('distinguishes an in-flight activation from a settled one', () => {
    // The enrollment is already `active` in both cases, so the payment detail —
    // not the status badge — is what has to differ.
    const reconciling = render([
      {
        enrollment: { id: ENROLLMENT_ID, status: 'active' },
        transaction: {
          id: 'tx-1',
          enrollment_id: ENROLLMENT_ID,
          status: 'paid',
          reconciliation_status: 'reconciling',
          gross_amount: 250000,
        },
      },
    ]);

    expect(reconciling).toContain('Pembayaran diterima, aktivasi diproses');
    expect(reconciling).toContain('Aktivasi enrollment sedang dicoba ulang oleh sistem.');
    expect(reconciling).not.toContain('Pembayaran diterima dan enrollment telah aktif.');

    const settled = render([
      {
        enrollment: { id: ENROLLMENT_ID, status: 'active' },
        transaction: {
          id: 'tx-1',
          enrollment_id: ENROLLMENT_ID,
          status: 'paid',
          reconciliation_status: 'active',
          gross_amount: 250000,
        },
      },
    ]);

    expect(settled).toContain('Aktif');
    expect(settled).toContain('Pembayaran diterima dan enrollment telah aktif.');
  });

  it('shows a permission marker instead of "no transaction" for a refused payment', () => {
    // KEL-57: billing answered 403 because the member lacks `billing:read`.
    const html = render([
      { enrollment: { id: ENROLLMENT_ID, status: 'active' }, paymentForbidden: true },
    ]);

    expect(html).toContain('Tidak tersedia untuk role Anda');
    expect(html).toContain('billing:read');
    expect(html).toContain('Nominal tidak tersedia');
    expect(html).not.toContain('Menunggu transaksi');
    expect(html).not.toContain('Nominal belum tersedia');
    // Both the card and the table layout carry the marker.
    expect(html.split('Tidak tersedia untuk role Anda')).toHaveLength(3);
  });

  it('shows an enrollment without a schedule and without a class name', () => {
    // A private enrollment has no schedule id, and a class may have been
    // removed from the payload; neither case may crash the row.
    const html = render([{ enrollment: { id: ENROLLMENT_ID, status: 'completed' } }]);

    expect(html).toContain('Student');
    expect(html).toContain('Kelas');
    expect(html).toContain('Selesai');
  });

  it('distinguishes an empty tenant from an empty filter result', () => {
    // A filter that matched nothing must not tell the tenant they have no
    // enrollment at all, because the fix is different in each case.
    const unfiltered = render([], false);
    const filtered = render([], true);

    expect(unfiltered).toContain('Belum ada enrollment');
    expect(unfiltered).toContain('Enrollment student akan muncul di sini');

    expect(filtered).toContain('Tidak ada enrollment pada status ini');
    expect(filtered).toContain('Ubah atau atur ulang filter status');
  });
});
