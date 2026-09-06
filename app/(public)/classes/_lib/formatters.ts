export function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.trunc(price));
}

export function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toLocaleString('id-ID', { maximumFractionDigits: 2 })} km`;
}

const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function formatDayOfWeek(dayOfWeek: number): string {
  return dayNames[dayOfWeek - 1] || 'Hari tidak diketahui';
}

export function formatTime(time: string): string {
  const match = /^(\d{2}:\d{2})/.exec(time);
  return match?.[1] || time || 'Waktu tidak tersedia';
}