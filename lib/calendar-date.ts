export type DateParts = [string, string, string]; // day, month, year

export function splitCalendarDate(value: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? [match[3], match[2], match[1]] : ['', '', ''];
}

export function monthDays(year: number, month: number) {
  return [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Calendar-only ISO; never interpreted as a browser/server timezone instant. */
export function joinCalendarDate([day, month, year]: DateParts): string {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year) || y < 1 || m < 1 || m > 12 || d < 1 || d > monthDays(y, m)) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function calendarDateError(parts: DateParts, required: boolean, min?: string, max?: string): string {
  if (parts.every(part => !part)) return required ? 'Tanggal wajib diisi.' : '';
  const value = joinCalendarDate(parts);
  if (!value) return 'Masukkan tanggal lengkap yang valid (hari, bulan, tahun).';
  if (min && value < min) return `Tanggal paling awal adalah ${min}.`;
  if (max && value > max) return `Tanggal paling akhir adalah ${max}.`;
  return '';
}

export function pastedCalendarDate(text: string): DateParts | null {
  // Parse complete shapes even when impossible, so the field can show the
  // attempted date and its validation error rather than retaining a stale value.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return splitCalendarDate(text.trim());
  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text.trim());
  const parts: DateParts | null = match ? [match[1], match[2], match[3]] : null;
  return parts;
}
