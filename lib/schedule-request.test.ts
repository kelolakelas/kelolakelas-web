import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_SCHEDULE_REQUEST_MESSAGE,
  findMatchingEnrollment,
  normalizeScheduleRequests,
  scheduleRequestCancelErrorMessage,
  scheduleRequestErrorMessage,
  scheduleRequestListAnchor,
  scheduleRequestPayload,
  scheduleRequestStatusLabel,
  scheduleSlotLabel,
  selectRequestsForClass,
  validateScheduleSlotDrafts,
  scheduleRequestFormSchema,
} from './schedule-request';

const CLASS_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const STUDENT_ID = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b',
    class_id: CLASS_ID,
    student_id: STUDENT_ID,
    billing_cycle: 'monthly',
    slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
    note: null,
    status: 'pending',
    rejection_reason: null,
    decided_at: null,
    ...overrides,
  };
}

describe('scheduleRequestFormSchema (KEL-109)', () => {
  it('accepts a valid request', () => {
    const result = scheduleRequestFormSchema.safeParse({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
      note: 'Lokasi les di rumah.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty slot list', () => {
    const result = scheduleRequestFormSchema.safeParse({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.slots?.[0]).toContain('minimal satu slot');
    }
  });

  it.each([0, 8, 1.5])('rejects a day_of_week of %s', (day) => {
    const result = scheduleRequestFormSchema.safeParse({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: day, start_time: '16:00', end_time: '17:30' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a slot whose end is not after its start', () => {
    for (const [start, end] of [['17:30', '17:30'], ['18:00', '17:30']]) {
      const result = scheduleRequestFormSchema.safeParse({
        student_id: STUDENT_ID,
        billing_cycle: 'monthly',
        slots: [{ day_of_week: 1, start_time: start, end_time: end }],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.slots?.join(' ')).toContain('setelah jam mulai');
      }
    }
  });

  it('rejects a note longer than 2000 characters', () => {
    const result = scheduleRequestFormSchema.safeParse({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
      note: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('drops a blank note from the payload', () => {
    const payload = scheduleRequestPayload({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
      note: '   ',
    });
    expect(payload).toEqual({
      student_id: STUDENT_ID,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
    });
  });
});

describe('validateScheduleSlotDrafts (KEL-109 client pre-check)', () => {
  it('rejects an empty draft list before any request is sent', () => {
    expect(validateScheduleSlotDrafts([])).toContain('minimal satu slot');
  });

  it.each([
    ['17:30', '17:30'],
    ['18:00', '17:30'],
  ])('rejects a draft with start %s and end %s', (start, end) => {
    expect(validateScheduleSlotDrafts([{ day_of_week: '1', start_time: start, end_time: end }])).toContain(
      'setelah jam mulai'
    );
  });

  it('rejects a draft day outside 1-7', () => {
    expect(validateScheduleSlotDrafts([{ day_of_week: '0', start_time: '16:00', end_time: '17:30' }])).toContain(
      'Senin (1) sampai Minggu (7)'
    );
  });

  it('accepts valid drafts', () => {
    expect(
      validateScheduleSlotDrafts([
        { day_of_week: '1', start_time: '16:00', end_time: '17:30' },
        { day_of_week: '3', start_time: '09:00', end_time: '10:00' },
      ])
    ).toBeNull();
  });
});

describe('scheduleSlotLabel (KEL-109)', () => {
  it.each([
    [1, 'Senin'],
    [2, 'Selasa'],
    [3, 'Rabu'],
    [4, 'Kamis'],
    [5, 'Jumat'],
    [6, 'Sabtu'],
    [7, 'Minggu'],
  ])('names ISO day %i in Indonesian as %s', (day, name) => {
    expect(scheduleSlotLabel({ day_of_week: day, start_time: '16:00:00', end_time: '17:30:00' })).toBe(
      `${name}, 16:00–17:30`
    );
  });

  it.each([{ day_of_week: 0 }, { day_of_week: 8 }, { day_of_week: 1.5 }, { start_time: '' }, { end_time: null }])(
    'never renders a malformed slot %j',
    (slot) => {
      expect(scheduleSlotLabel({ day_of_week: 1, start_time: '16:00', end_time: '17:30', ...((slot as object) || {}) } as never)).toBeNull();
    }
  );

  it('never renders a null slot', () => {
    expect(scheduleSlotLabel(null)).toBeNull();
    expect(scheduleSlotLabel(undefined)).toBeNull();
  });
});

describe('schedule request error mapping (KEL-109)', () => {
  it('reports a duplicate as a pending request with the list link message', () => {
    expect(scheduleRequestErrorMessage(409)).toBe(DUPLICATE_SCHEDULE_REQUEST_MESSAGE);
    expect(scheduleRequestErrorMessage(409)).toContain('masih menunggu');
  });

  it('maps 401/403 to the parent login message', () => {
    expect(scheduleRequestErrorMessage(401)).toContain('parent yang login');
    expect(scheduleRequestErrorMessage(403)).toContain('parent yang login');
  });

  it('maps 404 to the reload message', () => {
    expect(scheduleRequestErrorMessage(404)).toContain('Muat ulang');
  });

  it.each([400, 422])('maps a %s to the validation message', (status) => {
    expect(scheduleRequestErrorMessage(status)).toContain('tidak dapat diproses');
  });

  it('maps server errors to the unavailable message', () => {
    expect(scheduleRequestErrorMessage(500)).toContain('tidak tersedia');
    expect(scheduleRequestErrorMessage(502, 'raw go error')).not.toContain('raw go error');
  });

  it('maps cancel refusals without leaking backend text', () => {
    expect(scheduleRequestCancelErrorMessage(404)).toContain('tidak ditemukan');
    expect(scheduleRequestCancelErrorMessage(409)).toContain('statusnya sudah berubah');
    expect(scheduleRequestCancelErrorMessage(500, 'ERROR: deadlock')).not.toContain('deadlock');
  });

  it('labels every request status in Indonesian', () => {
    expect(scheduleRequestStatusLabel('pending')).toBe('Menunggu peninjauan');
    expect(scheduleRequestStatusLabel('approved')).toBe('Disetujui');
    expect(scheduleRequestStatusLabel('rejected')).toBe('Ditolak');
    expect(scheduleRequestStatusLabel('cancelled')).toBe('Dibatalkan');
  });

  it('builds the request-list anchor for the class being viewed', () => {
    expect(scheduleRequestListAnchor(CLASS_ID)).toBe(`/kelas/${CLASS_ID}#daftar-permintaan-jadwal`);
  });
});

describe('schedule request list helpers (KEL-109)', () => {
  it('drops malformed rows instead of throwing', () => {
    expect(
      normalizeScheduleRequests({ items: [request(), { id: 'broken' }, null, request({ status: 'unknown' })] })
    ).toHaveLength(1);
    expect(normalizeScheduleRequests({ items: 'nope' })).toEqual([]);
  });

  it('keeps only requests of the class being viewed', () => {
    const mine = request();
    const other = request({ id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c', class_id: 'other-class' });
    expect(selectRequestsForClass([mine, other] as never, CLASS_ID)).toEqual([mine]);
  });

  it('matches an approved request to its enrollment via student + class', () => {
    const match = findMatchingEnrollment({ student_id: STUDENT_ID, class_id: CLASS_ID }, [
      { id: 'enrollment-1', student_id: 'other', class_id: CLASS_ID },
      { id: 'enrollment-2', student_id: STUDENT_ID, class_id: CLASS_ID },
    ]);
    expect(match).toEqual({ id: 'enrollment-2' });
  });

  it('returns null when no enrollment row matches', () => {
    expect(findMatchingEnrollment({ student_id: STUDENT_ID, class_id: CLASS_ID }, [])).toBeNull();
    expect(
      findMatchingEnrollment({ student_id: STUDENT_ID, class_id: CLASS_ID }, [
        { id: 'enrollment-1', student_id: STUDENT_ID, class_id: 'other-class' },
      ])
    ).toBeNull();
  });
});
