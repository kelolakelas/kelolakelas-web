import type { EnrollmentRecord } from '@/lib/payment-status';

/** Indonesian weekday names in ISO order (Senin = 1). Shared with private schedule-request slot labels (KEL-109). */
export const WEEKDAY_NAMES: readonly string[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Label shown when an enrollment points at a schedule the backend no longer describes. */
export const SCHEDULE_UNAVAILABLE_LABEL = 'Jadwal tidak tersedia';

/**
 * Schedule line for a parent enrollment card (KEL-70), or `null` when the card
 * should show no schedule row at all.
 *
 * - A private enrollment has no `schedule_id` and no summary: no row.
 * - A valid summary renders as `Senin, 16:00–17:30 · Ruang A`, the same format
 *   as the catalog and the tenant dashboard (`lib/catalog.ts::scheduleLabels`),
 *   with the location appended only when it is present.
 * - An enrollment with a `schedule_id` whose summary is missing or unusable
 *   (the schedule was deleted, or an older backend that does not send the field)
 *   renders {@link SCHEDULE_UNAVAILABLE_LABEL} rather than guessing.
 *
 * The summary arrives from the network, so every field is re-checked: day_of_week
 * must be an integer 1–7 (ISO, Senin = 1) and both times must be strings.
 */
export function enrollmentScheduleLabel(enrollment: Pick<EnrollmentRecord, 'schedule_id' | 'schedule'>): string | null {
  const schedule = enrollment.schedule;
  const hasScheduleId = typeof enrollment.schedule_id === 'string' && enrollment.schedule_id !== '';
  if (!schedule || typeof schedule !== 'object') return hasScheduleId ? SCHEDULE_UNAVAILABLE_LABEL : null;

  const dayIndex = schedule.day_of_week;
  const day = typeof dayIndex === 'number' && Number.isInteger(dayIndex) ? WEEKDAY_NAMES[dayIndex - 1] : undefined;
  const start = typeof schedule.start_time === 'string' ? schedule.start_time.slice(0, 5) : '';
  const end = typeof schedule.end_time === 'string' ? schedule.end_time.slice(0, 5) : '';
  if (!day || !start || !end) return SCHEDULE_UNAVAILABLE_LABEL;

  const label = `${day}, ${start}–${end}`;
  const location = typeof schedule.location === 'string' ? schedule.location.trim() : '';
  return location ? `${label} · ${location}` : label;
}
