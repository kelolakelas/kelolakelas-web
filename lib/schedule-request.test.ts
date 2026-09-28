import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_SCHEDULE_REQUEST_MESSAGE,
  findMatchingEnrollment,
  hasPendingRecommendation,
  normalizeApprovePayment,
  normalizeRecommendedSlots,
  normalizeScheduleRequests,
  scheduleRecommendationDecisionErrorMessage,
  scheduleRecommendationStatus,
  scheduleRecommendationStatusLabel,
  scheduleRequestCancelErrorMessage,
  scheduleRequestDecisionErrorMessage,
  scheduleRequestErrorMessage,
  scheduleRequestListAnchor,
  scheduleRequestPayload,
  scheduleRequestPaymentLink,
  scheduleRequestStatusLabel,
  scheduleRequestTimeForBackend,
  scheduleSlotLabel,
  selectRequestsForClass,
  validateScheduleSlotDrafts,
  scheduleRequestFormSchema,
} from './schedule-request';
import { PLATFORM_FEE_EXCEEDS_GROSS_CODE, platformFeeRejectedState } from './enrollment';

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

describe('schedule request decision error mapping (KEL-110)', () => {
  it('maps 401/403 to the enrollment:update permission message', () => {
    for (const status of [401, 403]) {
      const message = scheduleRequestDecisionErrorMessage(status, 'forbidden: missing enrollment:update');
      expect(message).toContain('enrollment:update');
      expect(message).not.toContain('forbidden: missing enrollment:update');
    }
  });

  it('maps 404 to the reload message for a row outside this tenant', () => {
    expect(scheduleRequestDecisionErrorMessage(404)).toContain('tidak ditemukan');
    expect(scheduleRequestDecisionErrorMessage(404)).toContain('Muat ulang');
  });

  it('maps 409 to the already-changed message', () => {
    const message = scheduleRequestDecisionErrorMessage(409, 'duplicate key');
    expect(message).toContain('statusnya sudah berubah');
    expect(message).toContain('dibatalkan parent atau diproses anggota lain');
    expect(message).not.toContain('duplicate key');
  });

  it('reuses the KEL-106 platform-fee wording for the matching 422 code', () => {
    expect(scheduleRequestDecisionErrorMessage(422, 'fee too high', PLATFORM_FEE_EXCEEDS_GROSS_CODE)).toBe(
      platformFeeRejectedState.message
    );
  });

  it('maps other 400/422 refusals to the validation message', () => {
    expect(scheduleRequestDecisionErrorMessage(400)).toContain('tidak dapat diproses');
    expect(scheduleRequestDecisionErrorMessage(422, 'fee too high', 'other_code')).toContain('tidak dapat diproses');
    expect(scheduleRequestDecisionErrorMessage(422, 'fee too high', 'other_code')).not.toContain('fee too high');
  });

  it('maps server errors to the unavailable message without leaking backend text', () => {
    expect(scheduleRequestDecisionErrorMessage(500, 'ERROR: deadlock')).toContain('tidak tersedia');
    expect(scheduleRequestDecisionErrorMessage(500, 'ERROR: deadlock')).not.toContain('deadlock');
  });

  it('passes a trimmed backend message through only for unmapped statuses', () => {
    expect(scheduleRequestDecisionErrorMessage(418, '  teapot  ')).toBe('teapot');
    expect(scheduleRequestDecisionErrorMessage(418)).toContain('tidak tersedia');
  });
});

describe('schedule request approve payment helpers (KEL-110)', () => {
  it('accepts only http(s) checkout links', () => {
    expect(scheduleRequestPaymentLink('https://pay.test/checkout/x')).toBe('https://pay.test/checkout/x');
    expect(scheduleRequestPaymentLink('http://pay.test/checkout/x')).toBe('http://pay.test/checkout/x');
    expect(scheduleRequestPaymentLink('javascript:alert(1)')).toBeNull();
    expect(scheduleRequestPaymentLink('ftp://pay.test/x')).toBeNull();
    expect(scheduleRequestPaymentLink('not a url')).toBeNull();
    expect(scheduleRequestPaymentLink('')).toBeNull();
    expect(scheduleRequestPaymentLink(null)).toBeNull();
  });

  it('reads the payment side of a successful approve answer', () => {
    expect(
      normalizeApprovePayment({
        enrollment: { id: 'enrollment-1' },
        payment: {
          transaction_id: 'tx-1',
          checkout_session_url: 'https://pay.test/checkout/x',
          gross_amount: 1500000,
          status: 'pending',
        },
      })
    ).toEqual({ url: 'https://pay.test/checkout/x', grossAmount: 1500000 });
  });

  it('keeps the approval usable when billing omits the nominal', () => {
    expect(
      normalizeApprovePayment({ payment: { checkout_session_url: 'https://pay.test/checkout/x' } })
    ).toEqual({ url: 'https://pay.test/checkout/x', grossAmount: null });
  });

  it('returns null when no usable link can be shown', () => {
    expect(normalizeApprovePayment(null)).toBeNull();
    expect(normalizeApprovePayment({})).toBeNull();
    expect(normalizeApprovePayment({ payment: null })).toBeNull();
    expect(normalizeApprovePayment({ payment: { checkout_session_url: 'javascript:alert(1)' } })).toBeNull();
    expect(normalizeApprovePayment({ payment: { checkout_session_url: 'https://pay.test/x', gross_amount: 'x' } })).toEqual({
      url: 'https://pay.test/x',
      grossAmount: null,
    });
  });
});

describe('schedule request tenant fields (KEL-110)', () => {
  it('preserves the tenant-scoped columns when the backend sends them', () => {
    const [row] = normalizeScheduleRequests({
      items: [
        request({
          tenant_id: 'tenant-1',
          parent_id: 'parent-1',
          parent_email: 'ortu@example.com',
          created_at: '2026-09-20T10:00:00Z',
        }),
      ],
    });
    expect(row.tenant_id).toBe('tenant-1');
    expect(row.parent_id).toBe('parent-1');
    expect(row.parent_email).toBe('ortu@example.com');
    expect(row.created_at).toBe('2026-09-20T10:00:00Z');
  });

  it('defaults missing tenant columns to null instead of failing', () => {
    const [row] = normalizeScheduleRequests({ items: [request()] });
    expect(row.tenant_id).toBeNull();
    expect(row.parent_id).toBeNull();
    expect(row.parent_email).toBeNull();
    expect(row.created_at).toBeNull();
  });
});

describe('schedule recommendation helpers (KEL-116)', () => {
  const recommended = [{ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }];

  it('labels the declined status in Indonesian', () => {
    expect(scheduleRequestStatusLabel('declined')).toContain('ditolak');
  });

  it('keeps well-formed recommended slots from a network row', () => {
    expect(normalizeRecommendedSlots(recommended)).toEqual(recommended);
  });

  it('drops malformed recommended slots instead of guessing', () => {
    expect(normalizeRecommendedSlots([{ day_of_week: 0, start_time: '10:00', end_time: '11:00' }])).toBeUndefined();
    expect(
      normalizeRecommendedSlots([{ day_of_week: 1.5, start_time: '10:00', end_time: '11:00' }])
    ).toBeUndefined();
    expect(normalizeRecommendedSlots([{ day_of_week: 1, start_time: '', end_time: '11:00' }])).toBeUndefined();
    expect(normalizeRecommendedSlots([{ day_of_week: 1, start_time: '10:00' }])).toBeUndefined();
    expect(normalizeRecommendedSlots([null])).toBeUndefined();
  });

  it('treats absent or empty recommended slots as no recommendation', () => {
    expect(normalizeRecommendedSlots(undefined)).toBeUndefined();
    expect(normalizeRecommendedSlots(null)).toBeUndefined();
    expect(normalizeRecommendedSlots([])).toBeUndefined();
    expect(normalizeRecommendedSlots('nope')).toBeUndefined();
  });

  it('preserves recommended slots through the request normalizer', () => {
    const [row] = normalizeScheduleRequests({ items: [request({ status: 'rejected', recommended_slots: recommended })] });
    expect(row.recommended_slots).toEqual(recommended);
  });

  it('defaults missing recommended slots to undefined instead of failing', () => {
    const [row] = normalizeScheduleRequests({ items: [request()] });
    expect(row.recommended_slots).toBeUndefined();
  });

  it('still normalizes declined rows', () => {
    const [row] = normalizeScheduleRequests({
      items: [request({ status: 'declined', recommended_slots: recommended })],
    });
    expect(row.status).toBe('declined');
    expect(row.recommended_slots).toEqual(recommended);
  });

  it('expands HH:MM drafts to the backend HH:MM:SS format', () => {
    expect(scheduleRequestTimeForBackend('16:00')).toBe('16:00:00');
    expect(scheduleRequestTimeForBackend('09:05')).toBe('09:05:00');
    expect(scheduleRequestTimeForBackend('16:00:00')).toBe('16:00:00');
  });

  it('derives the recommendation status from the row', () => {
    expect(scheduleRecommendationStatus({ status: 'rejected', recommended_slots: recommended })).toBe('pending');
    expect(scheduleRecommendationStatus({ status: 'approved', recommended_slots: recommended })).toBe('accepted');
    expect(scheduleRecommendationStatus({ status: 'declined', recommended_slots: recommended })).toBe('declined');
    expect(scheduleRecommendationStatus({ status: 'rejected', recommended_slots: undefined })).toBe('none');
    expect(scheduleRecommendationStatus({ status: 'rejected', recommended_slots: [] })).toBe('none');
    expect(scheduleRecommendationStatus({ status: 'pending', recommended_slots: recommended })).toBe('none');
  });

  it('labels every live recommendation status in Indonesian', () => {
    expect(scheduleRecommendationStatusLabel('pending')).toContain('Menunggu');
    expect(scheduleRecommendationStatusLabel('accepted')).toContain('diterima');
    expect(scheduleRecommendationStatusLabel('declined')).toContain('ditolak');
    expect(scheduleRecommendationStatusLabel('none')).toBeNull();
  });

  it('reports only rejected rows with slots as still awaiting the parent', () => {
    expect(hasPendingRecommendation({ status: 'rejected', recommended_slots: recommended })).toBe(true);
    expect(hasPendingRecommendation({ status: 'declined', recommended_slots: recommended })).toBe(false);
    expect(hasPendingRecommendation({ status: 'approved', recommended_slots: recommended })).toBe(false);
    expect(hasPendingRecommendation({ status: 'rejected', recommended_slots: undefined })).toBe(false);
    expect(hasPendingRecommendation({ status: 'rejected', recommended_slots: [] })).toBe(false);
  });
});

describe('schedule recommendation decision error mapping (KEL-116)', () => {
  it('maps 401/403 to the owning-parent login message', () => {
    for (const status of [401, 403]) {
      const message = scheduleRecommendationDecisionErrorMessage(status, 'forbidden');
      expect(message).toContain('parent');
      expect(message).not.toContain('forbidden');
    }
  });

  it('maps 404 to the reload message for a recommendation outside this account', () => {
    expect(scheduleRecommendationDecisionErrorMessage(404)).toContain('tidak ditemukan');
    expect(scheduleRecommendationDecisionErrorMessage(404)).toContain('Muat ulang');
  });

  it('maps 409 to the already-changed message', () => {
    const message = scheduleRecommendationDecisionErrorMessage(409, 'already accepted');
    expect(message).toContain('statusnya sudah berubah');
    expect(message).not.toContain('already accepted');
  });

  it('reuses the KEL-106 platform-fee wording for the matching 422 code', () => {
    expect(scheduleRecommendationDecisionErrorMessage(422, 'fee too high', PLATFORM_FEE_EXCEEDS_GROSS_CODE)).toBe(
      platformFeeRejectedState.message
    );
  });

  it('maps other 400/422 refusals to the validation message', () => {
    expect(scheduleRecommendationDecisionErrorMessage(400)).toContain('tidak dapat diproses');
    expect(scheduleRecommendationDecisionErrorMessage(422, 'slots invalid', 'other_code')).toContain('tidak dapat diproses');
    expect(scheduleRecommendationDecisionErrorMessage(422, 'slots invalid', 'other_code')).not.toContain('slots invalid');
  });

  it('maps server errors to the unavailable message without leaking backend text', () => {
    expect(scheduleRecommendationDecisionErrorMessage(500, 'ERROR: deadlock')).toContain('tidak tersedia');
    expect(scheduleRecommendationDecisionErrorMessage(500, 'ERROR: deadlock')).not.toContain('deadlock');
  });

  it('reports network failures without backend text', () => {
    expect(scheduleRecommendationDecisionErrorMessage(0)).toContain('tidak tersedia');
  });
});
