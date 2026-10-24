import { enrollmentFormSchema, enrollmentSubmissionValues, type EnrollmentSubmissionValues } from './enrollment';

export type CheckoutAttempt = { key: string; values: EnrollmentSubmissionValues };
const changed = 'kelolakelas-checkout-attempt';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkoutAttemptStorageKey(parentId: string | undefined, classId: string): string | null {
  return parentId && uuid.test(parentId) && uuid.test(classId)
    ? `kelolakelas:checkout:v1:${parentId}:${classId}` : null;
}

export function parseCheckoutAttempt(raw: string | null): CheckoutAttempt | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value = JSON.parse(raw);
    const result = enrollmentFormSchema.safeParse({ ...value.values, idempotency_key: value.key });
    if (!result.success || !result.data.schedule_id) return null;
    const { idempotency_key, ...fields } = result.data;
    return { key: idempotency_key, values: { ...fields, voucher_code: fields.voucher_code ?? '' } };
  } catch { return null; }
}

export function readCheckoutAttempt(key: string | null): string | null {
  try { return key ? window.sessionStorage.getItem(key) : null; } catch { return null; }
}

export function subscribeCheckoutAttempts(notify: () => void) {
  window.addEventListener(changed, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener('storage', notify);
  };
}

export function saveCheckoutAttempt(key: string | null, form: FormData): boolean {
  if (!key) return false;
  const raw = JSON.stringify({ key: form.get('idempotency_key'), values: enrollmentSubmissionValues(form) });
  if (!parseCheckoutAttempt(raw)) return false;
  try {
    window.sessionStorage.setItem(key, raw);
    window.dispatchEvent(new Event(changed));
    return true;
  } catch { return false; }
}

export function matchesCheckoutAttempt(attempt: CheckoutAttempt | null, values: EnrollmentSubmissionValues): boolean {
  return !!attempt && (Object.keys(values) as (keyof EnrollmentSubmissionValues)[])
    .every((field) => attempt.values[field] === values[field]);
}
