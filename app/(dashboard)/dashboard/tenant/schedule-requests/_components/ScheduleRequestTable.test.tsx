import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { TenantScheduleRequestRow } from '../_queries/queries';

/**
 * Render test for the tenant schedule-request work queue (KEL-110).
 *
 * The Server Actions are mocked because this covers markup only; the action
 * contract lives in `_actions/actions.test.ts` and the helpers in
 * `_lib/schema.test.ts` and `lib/schedule-request.test.ts`.
 *
 * `renderToStaticMarkup` is used directly instead of a DOM testing library:
 * the table itself is a Server Component with no state, so the rendered
 * markup is the whole contract and no extra test dependency is needed. Both
 * layout branches are asserted because the component renders the cards and
 * the table into the same document, with CSS deciding which one a visitor
 * sees.
 */

vi.mock('../_actions/actions', () => ({
  approveScheduleRequest: vi.fn(),
  rejectScheduleRequest: vi.fn(),
}));

// The table embeds the KEL-124 chat entry button, a Client Component that
// navigates with `useRouter`. Static markup rendering has no router, so both
// collaborators are stubbed: the button then renders its label and the test
// asserts the entry point is present without exercising navigation.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/chat-actions', () => ({
  createScheduleRequestChat: vi.fn(async () => ({ data: null, error: null })),
}));

const { ScheduleRequestTable } = await import('./ScheduleRequestTable');

const REQUEST_ID = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';

function row(overrides: Record<string, unknown> = {}, labels: { className?: string | null; student?: unknown } = {}): TenantScheduleRequestRow {
  return {
    request: {
      id: REQUEST_ID,
      class_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
      student_id: '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22',
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
      note: null,
      status: 'pending',
      rejection_reason: null,
      decided_at: null,
      tenant_id: 'tenant-1',
      parent_id: 'parent-1',
      parent_email: 'ortu@example.com',
      created_at: '2026-09-20T10:00:00Z',
      ...overrides,
    } as TenantScheduleRequestRow['request'],
    className: labels.className !== undefined ? labels.className : 'Matematika Private',
    student:
      labels.student !== undefined
        ? (labels.student as TenantScheduleRequestRow['student'])
        : ({ id: 'student-1', first_name: 'Budi', last_name: 'Santoso' } as TenantScheduleRequestRow['student']),
  };
}

function render(rows: TenantScheduleRequestRow[]): string {
  return renderToStaticMarkup(<ScheduleRequestTable rows={rows} />);
}

describe('ScheduleRequestTable', () => {
  it('shows a pending request with its slot detail and both decision controls', () => {
    const html = render([row()]);

    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Matematika Private');
    expect(html).toContain('Bulanan');
    expect(html).toContain('Senin, 16:00–17:30');
    expect(html).toContain('Menunggu peninjauan');
    expect(html).toContain('ortu@example.com');
    expect(html).toContain('Setujui');
    expect(html).toContain('Tolak');
  });

  it('renders both the card and the table layout from the same rows', () => {
    const html = render([row()]);

    expect(html).toContain('md:hidden');
    expect(html).toContain('hidden md:block');
    expect(html).toContain('<table');
    // The table must be described for assistive technology.
    expect(html).toContain('Daftar permintaan jadwal private beserta status dan tindakannya');
  });

  it('keeps dialog ids unique across the mobile and desktop copies', () => {
    const html = render([row()]);

    // Both layout branches stay in the DOM, so every dialog id must carry
    // its branch prefix instead of colliding on the request id alone.
    expect(html).toContain(`mobile-approve-schedule-request-title-${REQUEST_ID}`);
    expect(html).toContain(`desktop-approve-schedule-request-title-${REQUEST_ID}`);
    expect(html).toContain(`mobile-reject-schedule-request-reason-${REQUEST_ID}`);
    expect(html).toContain(`desktop-reject-schedule-request-reason-${REQUEST_ID}`);
  });

  it('offers a parent-chat entry on every pending row copy (KEL-124)', () => {
    const html = render([row()]);

    // Both layout branches stay in the DOM, so the entry button appears once
    // per branch. Permission itself is enforced server-side by the
    // chat-service; the button stays visible and a refusal surfaces inline.
    expect(html.split('Chat dengan parent')).toHaveLength(3);
  });

  it('offers no decision controls once the row leaves pending', () => {
    const approved = render([row({ status: 'approved' })]);
    expect(approved).toContain('Disetujui');
    expect(approved).not.toContain('Setujui');
    expect(approved).not.toContain('>Tolak<');

    const rejected = render([row({ status: 'rejected', rejection_reason: 'Slot penuh, usulkan hari lain.' })]);
    expect(rejected).toContain('Ditolak');
    expect(rejected).toContain('Alasan penolakan: Slot penuh, usulkan hari lain.');
    expect(rejected).not.toContain('Setujui');

    const cancelled = render([row({ status: 'cancelled' })]);
    expect(cancelled).toContain('Dibatalkan');
    expect(cancelled).not.toContain('Setujui');
    // Chat entries live with the pending decision controls only; decided rows
    // keep their neutral placeholder.
    expect(cancelled).not.toContain('Chat dengan parent');
  });

  it('hides the rejection reason line when none was recorded', () => {
    const html = render([row({ status: 'rejected', rejection_reason: null })]);
    expect(html).toContain('Ditolak');
    expect(html).not.toContain('Alasan penolakan:');
  });

  it('shows the request note when the parent left one', () => {
    const html = render([row({ note: 'Lokasi les di rumah.' })]);
    expect(html).toContain('Catatan: Lokasi les di rumah.');
  });

  it('degrades missing labels to neutral placeholders', () => {
    const html = render([row({}, { className: null, student: null })]);
    expect(html).toContain('Kelas');
    expect(html).toContain('Student');
  });

  it('explains a row with no usable slots instead of rendering nothing', () => {
    const html = render([row({ slots: [] })]);
    expect(html).toContain('Slot tidak tersedia');
  });

  it('explains an empty filter result instead of an error', () => {
    const html = render([]);
    expect(html).toContain('Tidak ada permintaan jadwal pada status ini');
    expect(html).toContain('Ubah filter status untuk melihat permintaan jadwal lain.');
  });

  it('shows a waiting recommendation with its slots on a rejected row', () => {
    const html = render([
      row({
        status: 'rejected',
        rejection_reason: 'Slot penuh.',
        recommended_slots: [{ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }],
      }),
    ]);

    expect(html).toContain('Rekomendasi jadwal');
    expect(html).toContain('Selasa, 10:00–11:00');
    expect(html).toContain('Menunggu keputusan parent');
  });

  it('shows the accepted recommendation state on an approved row with slots', () => {
    const html = render([
      row({
        status: 'approved',
        recommended_slots: [{ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }],
      }),
    ]);

    expect(html).toContain('Disetujui');
    expect(html).toContain('Rekomendasi diterima');
  });

  it('shows the declined recommendation state with its tone', () => {
    const html = render([
      row({
        status: 'declined',
        rejection_reason: 'Slot penuh.',
        recommended_slots: [{ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }],
      }),
    ]);

    expect(html).toContain('Rekomendasi ditolak');
    expect(html).toContain('Selasa, 10:00–11:00');
  });

  it('renders no recommendation block on rows without one', () => {
    const html = render([row({ status: 'rejected', rejection_reason: 'Slot penuh.' })]);

    expect(html).toContain('Ditolak');
    expect(html).not.toContain('Rekomendasi jadwal');
  });
});
