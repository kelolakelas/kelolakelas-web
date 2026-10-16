/** Browser-local calendar fields; never slice the UTC API date before converting. */
export function voucherLocalDateTime(value: string | null | undefined) {
  if (!value) return { date: '', time: '' };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: '', time: '' };
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    date: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
    time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}:${pad(instant.getSeconds())}`,
  };
}

/** Resolve the browser's local time to an instant before a server in another timezone reads it. */
export function voucherDateTimePayload(date: string, time: string): string {
  if (!date) return '';
  const local = `${date}T${time}`;
  const instant = new Date(local);
  // Leave incomplete input invalid so the action schema also rejects it.
  return Number.isNaN(instant.getTime()) ? local : instant.toISOString();
}
