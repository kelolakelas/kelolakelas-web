'use client';

import { LocateFixed, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function LocationSearchButton() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [state, setState] = useState('');
  const locate = () => {
    if (!navigator.geolocation) { setState('Browser tidak mendukung lokasi.'); return; }
    setState('Mencari lokasi...');
    navigator.geolocation.getCurrentPosition((position) => { const next = new URLSearchParams(params); next.set('latitude', String(position.coords.latitude)); next.set('longitude', String(position.coords.longitude)); next.set('radius_km', '25'); next.set('sort', 'distance_asc'); next.set('page', '1'); setState('Radius 25 km aktif'); router.push(`${pathname}?${next}`); }, (error) => setState(error.code === error.PERMISSION_DENIED ? 'Izin lokasi ditolak.' : 'Lokasi tidak dapat ditemukan.'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };
  const clear = () => { const next = new URLSearchParams(params); ['latitude', 'longitude', 'radius_km'].forEach((key) => next.delete(key)); next.delete('page'); router.push(`${pathname}?${next}`); setState(''); };
  return <div className="flex min-h-11 flex-wrap items-center gap-2"><button type="button" onClick={locate} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#71863a] bg-white px-4 text-sm font-bold text-[#3e5519]"><LocateFixed size={17} aria-hidden="true" /> Cari kelas terdekat</button>{params.get('latitude') && <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-bold text-[#65726c]" aria-label="Hapus filter lokasi"><X size={15} aria-hidden="true" /> Hapus lokasi</button>}{state && <span role="status" className="text-xs text-[#65726c]">{state}</span>}</div>;
}