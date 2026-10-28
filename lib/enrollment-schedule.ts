import type { EnrollmentRecord } from '@/lib/payment-status';

/** Indonesian weekday names in ISO order (Senin = 1). Shared with private schedule-request slot labels (KEL-109). */
export const WEEKDAY_NAMES: readonly string[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Label shown when an enrollment points at a schedule the backend no longer describes. */
export const SCHEDULE_UNAVAILABLE_LABEL = 'Jadwal tidak tersedia';

/** Shared enrollment schedule text. Private collections retain server order and
 * render each version once with its effective dates. Explicit [] is empty;
 * missing private projection, malformed data and missing group summaries are
 * unavailable. Group singular summaries retain the KEL-70 format. */
export function enrollmentScheduleLabel(enrollment: Pick<EnrollmentRecord, 'schedule_id' | 'schedule' | 'private_schedules' | 'class'>): string | null {
  if (enrollment.private_schedules !== undefined) {
    if (!Array.isArray(enrollment.private_schedules)) return SCHEDULE_UNAVAILABLE_LABEL;
    if (!enrollment.private_schedules.length) return 'Belum ada jadwal';
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const slot of enrollment.private_schedules) {
      if (!slot || typeof slot.id !== 'string' || !slot.id) return SCHEDULE_UNAVAILABLE_LABEL;
      if (seen.has(slot.id)) continue;
      seen.add(slot.id);
      const label = enrollmentScheduleLabel({ schedule_id: slot.id, schedule: slot });
      if (!label || label === SCHEDULE_UNAVAILABLE_LABEL) return SCHEDULE_UNAVAILABLE_LABEL;
      const from = effectiveDate(slot.valid_from);
      const until = effectiveDate(slot.valid_until);
      if (from === false || until === false) return SCHEDULE_UNAVAILABLE_LABEL;
      const period = from || until ? ` · Berlaku ${from || 'awal'}–${until || 'seterusnya'}` : '';
      labels.push(label + period);
    }
    return labels.join('\n');
  }
  if (enrollment.class?.type === 'private') return SCHEDULE_UNAVAILABLE_LABEL;
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

function effectiveDate(value: string | null | undefined): string | false | null {
  if (value == null) return null;
  if (typeof value !== 'string') return false;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return false;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
}
