import { z } from 'zod';
import type { CheckoutInstructions } from './payment-instructions';

/**
 * Duitku channel the parent picks at checkout (KEL-127).
 *
 * Codes mirror the billing allowlist (KEL-125): `VC` card, `VA`/`BC` virtual
 * account, `SP`/`NQ` QRIS. Absent means the legacy hosted card flow. The
 * default is `VC` so an older form post without the field (cached page, retry
 * through an old tab) keeps paying exactly as before instead of failing
 * validation.
 */
export const PAYMENT_CHANNELS = ['VC', 'VA', 'BC', 'SP', 'NQ'] as const;

export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** Channels rendered as the card option: always the hosted provider redirect. */
export const CARD_PAYMENT_CHANNELS: readonly PaymentChannel[] = ['VC'];

/** Channels rendered with in-page KelolaKelas instructions after checkout. */
export const INSTRUCTION_PAYMENT_CHANNELS: readonly PaymentChannel[] = ['VA', 'BC', 'SP', 'NQ'];

/**
 * Channel options offered by the checkout picker (KEL-127).
 *
 * One representative code per kind: `VA` for virtual account, `NQ` for QRIS.
 * `BC`/`SP` remain accepted from the backend (history rows paid through them
 * render the same way) but are not offered as separate choices.
 */
export const PAYMENT_CHANNEL_OPTIONS: ReadonlyArray<{ value: PaymentChannel; label: string; hint: string }> = [
  { value: 'VC', label: 'Kartu kredit/debit', hint: 'Diarahkan ke halaman pembayaran aman Duitku.' },
  { value: 'VA', label: 'Virtual Account', hint: 'Nomor VA tampil di halaman ini, tanpa pindah halaman.' },
  { value: 'NQ', label: 'QRIS', hint: 'Kode QR tampil di halaman ini, tanpa pindah halaman.' },
];

export const enrollmentFormSchema = z.object({
  student_id: z.string().uuid('Pilih student yang valid.'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly'], { message: 'Pilih periode pembayaran.' }),
  schedule_id: z.union([z.string().uuid('Pilih jadwal yang valid.'), z.literal('')]),
  payment_method: z.enum(PAYMENT_CHANNELS, { message: 'Pilih metode pembayaran.' }).default('VC'),
  idempotency_key: z.string().uuid('Sesi checkout tidak valid. Muat ulang halaman lalu coba lagi.'),
});

export type EnrollmentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  /** Follow-up page shown as a link under the message, e.g. the parent's enrollment status. */
  link?: { href: string; label: string };
  /**
   * In-page payment instructions after a VA/QRIS checkout (KEL-127), read
   * back from billing by the action itself. Card checkouts keep the redirect
   * flow and never set this.
   */
  payment?: CheckoutInstructions;
};

export const PARENT_ENROLLMENTS_PATH = '/dashboard/parent/enrollments';

/** Machine-readable `code` academic sends with the 409 for a student already enrolled in the class. */
export const DUPLICATE_ENROLLMENT_CODE = 'duplicate_enrollment';

export const duplicateEnrollmentState: EnrollmentActionState = {
  success: false,
  message: 'Student ini sudah terdaftar atau masih memiliki pembayaran tertunda di kelas ini.',
  link: { href: PARENT_ENROLLMENTS_PATH, label: 'Lihat status enrollment' },
};

/**
 * True only for academic's duplicate-enrollment 409. A full schedule or an
 * idempotency conflict is also 409 but carries no `code`, and an older backend
 * never sends one, so both keep the generic 409 message.
 */
export function isDuplicateEnrollmentResponse(status: number, result: unknown) {
  return status === 409 && typeof result === 'object' && result !== null && (result as { code?: unknown }).code === DUPLICATE_ENROLLMENT_CODE;
}

/** Machine-readable `code` academic sends with the 422 when billing refuses the invoice because the platform fee exceeds the payment. */
export const PLATFORM_FEE_EXCEEDS_GROSS_CODE = 'platform_fee_exceeds_gross';

export const platformFeeRejectedState: EnrollmentActionState = {
  success: false,
  message: 'Kelas ini belum dapat dibayar karena biaya platform melebihi jumlah pembayaran. Hubungi penyelenggara kelas.',
};

/**
 * True only for academic's platform-fee 422. Other 422s (ownership, closed class)
 * carry no such `code`, and an older academic answers this rejection as a 500
 * without one, so both keep their existing messages.
 */
export function isPlatformFeeRejectedResponse(status: number, result: unknown) {
  return status === 422 && typeof result === 'object' && result !== null && (result as { code?: unknown }).code === PLATFORM_FEE_EXCEEDS_GROSS_CODE;
}

export function enrollmentPayload(input: z.infer<typeof enrollmentFormSchema>) {
  return {
    student_id: input.student_id,
    billing_cycle: input.billing_cycle,
    ...(input.schedule_id ? { schedule_id: input.schedule_id } : {}),
    payment_method: input.payment_method,
  };
}
