'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { calendarDateError, joinCalendarDate, monthDays, pastedCalendarDate, splitCalendarDate, type DateParts } from '@/lib/calendar-date';

type Props = {
  id?: string;
  name?: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string | (() => string);
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded disabled:opacity-50';

/** Segmented local calendar date. Only the hidden canonical field is submitted. */
export function DateInput({ id, name, label, value, defaultValue = '', onValueChange, min, max, required = false, disabled = false, className = '', ...aria }: Props) {
  const generated = useId();
  const fieldId = id ?? generated;
  const initial = value ?? defaultValue;
  const [draft, setDraft] = useState({ source: initial, defaultSource: defaultValue, emitted: initial, parts: splitCalendarDate(initial) });
  // Accept external resets without erasing partial segments echoed as an empty canonical value.
  if (value !== undefined && value !== draft.source) {
    setDraft({ source: value, defaultSource: defaultValue, emitted: value, parts: value === draft.emitted ? draft.parts : splitCalendarDate(value) });
  } else if (value === undefined && defaultValue !== draft.defaultSource) {
    setDraft({ source: defaultValue, defaultSource: defaultValue, emitted: defaultValue, parts: splitCalendarDate(defaultValue) });
  }
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [above, setAbove] = useState(false);
  const [touched, setTouched] = useState(false);
  const [cursor, setCursor] = useState({ year: 2026, month: 1, day: 1 });
  const maxDate = typeof max === 'function' ? max() : max;
  const canonical = joinCalendarDate(draft.parts);
  const groupClass = className.split(/\s+/).filter(token => token !== 'block' && !token.startsWith('py-')).map(token => token.startsWith('p-') ? token.replace('p-', 'px-') : token).join(' ');
  const weekdayOffset = new Date(`${String(cursor.year).padStart(4, '0')}-${String(cursor.month).padStart(2, '0')}-01T00:00:00Z`).getUTCDay();
  const error = calendarDateError(draft.parts, required, min, maxDate);
  const description = [aria['aria-describedby'], `${fieldId}-format`, touched && error ? `${fieldId}-error` : ''].filter(Boolean).join(' ');

  useEffect(() => { inputs.current[0]?.setCustomValidity(error); }, [error]);
  useEffect(() => {
    if (value !== undefined) return;
    const form = inputs.current[0]?.form;
    const reset = () => { setDraft({ source: defaultValue, defaultSource: defaultValue, emitted: defaultValue, parts: splitCalendarDate(defaultValue) }); setTouched(false); setOpen(false); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, defaultValue]);
  useEffect(() => {
    if (open) picker.current?.querySelector<HTMLButtonElement>('button[data-active="true"]')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function write(parts: DateParts) {
    const next = joinCalendarDate(parts);
    setDraft({ source: value ?? next, defaultSource: defaultValue, emitted: next, parts });
    setTouched(true);
    onValueChange?.(next);
  }
  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) pickerButton.current?.focus();
  }
  function showCalendar() {
    const today = new Date();
    const selected = canonical || (maxDate && `${today.getFullYear()}` > maxDate.slice(0, 4) ? maxDate : min) || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [day, month, year] = splitCalendarDate(selected).map(Number);
    setCursor({ year, month, day });
    setAlignRight((root.current?.getBoundingClientRect().left ?? 0) + 288 > window.innerWidth - 16);
    const bounds = root.current?.getBoundingClientRect();
    setAbove(Boolean(bounds && window.innerHeight - bounds.bottom < 365 && bounds.top > 365));
    setOpen(true);
  }
  function moveCalendar(offset: number) {
    const date = new Date(`${String(cursor.year).padStart(4, '0')}-${String(cursor.month).padStart(2, '0')}-${String(cursor.day).padStart(2, '0')}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return;
    const next = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
    setCursor(next);
    requestAnimationFrame(() => picker.current?.querySelector<HTMLButtonElement>(`button[data-day="${next.day}"]`)?.focus());
  }

  return (
    <div ref={root} className="relative min-w-0" onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) { setTouched(true); close(false); }
    }} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <input type="hidden" name={name} value={canonical} disabled={disabled} />
      <div role="group" aria-label={`${label} tanggal`} data-invalid={aria['aria-invalid'] || (touched && Boolean(error))} className={`flex min-w-0 items-center gap-1 data-[invalid=true]:border-red-500 dark:data-[invalid=true]:border-red-400 ${groupClass}`}>
        {draft.parts.map((part, index) => (
          <span key={index} className={`flex min-w-0 items-center ${index === 2 ? 'flex-1' : 'shrink-0'}`}>
            <input
              ref={element => { inputs.current[index] = element; }}
              id={index === 0 ? fieldId : `${fieldId}-${index}`}
              type="text" inputMode="numeric" autoComplete="off"
              value={part} placeholder={['HH', 'BB', 'TTTT'][index]}
              maxLength={index === 2 ? 4 : 2}
              required={required} disabled={disabled}
              aria-label={index === 0 ? (aria['aria-label'] ?? label) : `${label} ${index === 1 ? 'bulan' : 'tahun'}`}
              aria-describedby={description} aria-invalid={aria['aria-invalid'] || (touched && Boolean(error))}
              className={`${focusClass} min-h-11 bg-transparent text-center ${index === 2 ? 'w-full min-w-12' : 'w-8'}`}
              onInvalid={() => setTouched(true)}
              onFocus={event => {
                inputs.current[0]?.setCustomValidity(calendarDateError(draft.parts, required, min, typeof max === 'function' ? max() : max));
                event.currentTarget.select();
              }}
              onChange={event => {
                const text = event.target.value;
                // Accept full ISO input from assistive tools as well as supported date paste.
                const pasted = pastedCalendarDate(text);
                if (pasted) { write(pasted); return; }
                if (!/^\d*$/.test(text) || text.length > (index === 2 ? 4 : 2)) return;
                const next: DateParts = [...draft.parts]; next[index] = text; write(next);
                const bound = index === 0 ? 31 : 12;
                if (index < 2 && text.length === 2 && Number(text) >= 1 && Number(text) <= bound) { inputs.current[index + 1]?.focus(); inputs.current[index + 1]?.select(); }
              }}
              onPaste={event => {
                const parts = pastedCalendarDate(event.clipboardData.getData('text'));
                if (parts) { event.preventDefault(); write(parts); inputs.current[2]?.focus(); }
              }}
              onKeyDown={event => {
                if (event.key === 'Backspace' && !part && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); inputs.current[index - 1]?.select(); }
                if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0 && index > 0) inputs.current[index - 1]?.focus();
                if (event.key === 'ArrowRight' && event.currentTarget.selectionStart === part.length && index < 2) inputs.current[index + 1]?.focus();
                if (event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); showCalendar(); }
              }}
            />
            {index < 2 && <span aria-hidden="true">/</span>}
          </span>
        ))}
        <button ref={pickerButton} type="button" disabled={disabled} aria-label={`Buka kalender ${label}`} aria-expanded={open} aria-controls={`${fieldId}-calendar`} onClick={() => open ? close() : showCalendar()} className={`${focusClass} min-h-11 min-w-9 shrink-0 text-lg`}><span aria-hidden="true">▦</span></button>
        <button type="button" disabled={disabled} aria-label={`Kosongkan ${label}`} onClick={() => { write(['', '', '']); inputs.current[0]?.focus(); }} className={`${focusClass} min-h-11 min-w-8 shrink-0 text-lg`}><span aria-hidden="true">×</span></button>
      </div>
      <span id={`${fieldId}-format`} className="sr-only">Hari / bulan / tahun. Tempel YYYY-MM-DD atau DD/MM/YYYY. Alt+panah bawah membuka kalender.</span>
      {touched && error && <p id={`${fieldId}-error`} className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">{error}</p>}
      {open && !disabled && (
        <div ref={picker} id={`${fieldId}-calendar`} role="dialog" aria-label={`Kalender ${label}`} className={`absolute ${alignRight ? 'right-0' : 'left-0'} ${above ? 'bottom-full mb-1' : 'top-full mt-1'} z-50 max-h-[calc(100dvh-2rem)] overflow-auto w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-gray-300 bg-white p-3 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100`}>
          <div className="mb-2 flex gap-2">
            <select aria-label={`Bulan kalender ${label}`} value={cursor.month} onChange={event => setCursor({ ...cursor, month: Number(event.target.value), day: 1 })} className={`${focusClass} min-h-11 min-w-0 flex-1 border bg-inherit p-1`}>
              {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            </select>
            <input type="number" aria-label={`Tahun kalender ${label}`} min="1" max="9999" value={cursor.year} onChange={event => {
              const year = Number(event.target.value); if (Number.isInteger(year) && year >= 1 && year <= 9999) setCursor({ ...cursor, year, day: 1 });
            }} className={`${focusClass} min-h-11 w-20 border bg-inherit p-1`} />
          </div>
          <div className="grid grid-cols-7 text-center text-xs" aria-hidden="true">{['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => <span key={day}>{day}</span>)}</div>
          <div role="grid" aria-label={`${months[cursor.month - 1]} ${cursor.year}`} className="grid grid-cols-7">
            {Array.from({ length: Math.ceil((weekdayOffset + monthDays(cursor.year, cursor.month)) / 7) }, (_, week) => (
              <div role="row" key={week} className="contents">
              {Array.from({ length: 7 }, (_, weekday) => {
              const day = week * 7 + weekday - weekdayOffset + 1;
              if (day < 1 || day > monthDays(cursor.year, cursor.month)) return <span role="gridcell" key={`blank-${weekday}`} />;
              const iso = joinCalendarDate([String(day), String(cursor.month), String(cursor.year).padStart(4, '0')]);
              const unavailable = Boolean((min && iso < min) || (maxDate && iso > maxDate));
              return <button key={day} type="button" role="gridcell" data-day={day} data-active={day === cursor.day} tabIndex={day === cursor.day ? 0 : -1} aria-label={`${day} ${months[cursor.month - 1]} ${cursor.year}`} aria-selected={iso === canonical} aria-disabled={unavailable} onFocus={() => setCursor({ ...cursor, day })} className={`${focusClass} min-h-9 text-sm ${unavailable ? 'opacity-30' : 'hover:bg-blue-100 dark:hover:bg-blue-950'} ${iso === canonical ? 'bg-blue-600 text-white' : ''}`} onClick={() => { if (!unavailable) { write(splitCalendarDate(iso)); close(); } }} onKeyDown={event => {
                const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: 1 - day, End: monthDays(cursor.year, cursor.month) - day }[event.key];
                if (offset !== undefined) { event.preventDefault(); moveCalendar(offset); }
              }}>{day}</button>;
              })}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => close()} className={`${focusClass} mt-2 min-h-11 w-full border`}>Tutup kalender</button>
        </div>
      )}
    </div>
  );
}
