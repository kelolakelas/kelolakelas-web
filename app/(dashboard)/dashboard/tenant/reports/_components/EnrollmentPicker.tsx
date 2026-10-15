'use client';

import { useRef, useState } from 'react';
import { searchDirectEnrollments, searchTaughtEnrollments } from '../_actions/enrollment-search';
import type { EnrollmentPickerResult } from '../_queries/queries';

/**
 * Server-search student picker for the report create form (KEL-167).
 *
 * The old static select prefetched up to 1000 enrollments/sessions when the
 * page loaded and silently truncated beyond that. This picker reads exactly
 * one backend page per explicit search/pagination action and never fetches
 * on mount, so opening the form downloads nothing — search runs only when
 * the member presses Cari or walks pages.
 *
 * Path selection follows the permission the caller actually holds: the
 * first search probes the direct enrollment list (`enrollment:read`,
 * Creator path) and falls back to the taught-session lookup
 * (`schedule:read`, Teacher path) when the direct list refuses with
 * `forbidden`. The Teacher backend `search` only matches the class name,
 * so the class filter runs the class-first step: it lists the distinct
 * classes found on the requested page, and the member list below shows
 * that page's students. The report create action still enforces the
 * assignment server-side, so an enrollment chosen here is re-checked on
 * submit.
 */
export function EnrollmentPicker({
  dialogId,
  onSelectionChange,
}: {
  dialogId: string;
  onSelectionChange?: (selected: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [mode, setMode] = useState<'direct' | 'taught' | null>(null);
  const [items, setItems] = useState<{ enrollment_id: string; label: string; class_id: string }[]>([]);
  const [classes, setClasses] = useState<{ class_id: string; name: string }[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  // Race guard: a slow earlier response never overwrites a newer query.
  const requestId = useRef(0);

  async function runSearch(search: string, nextPage: number, forcedMode: 'direct' | 'taught' | null) {
    const current = requestId.current + 1;
    requestId.current = current;
    setLoading(true);
    setError('');
    setNotice('');

    const read = forcedMode === 'taught' ? searchTaughtEnrollments : searchDirectEnrollments;
    const result = await read(search, nextPage);

    if (requestId.current !== current) {
      return;
    }

    // First probe decides the path: a refused direct list means the caller
    // has no `enrollment:read`, so the taught lookup serves this member.
    if (forcedMode === null && result.error === 'forbidden') {
      const taught = await searchTaughtEnrollments(search, nextPage);

      if (requestId.current !== current) {
        return;
      }

      if (taught.error === null && taught.data !== null) {
        setMode('taught');
        applyPage(taught.data, nextPage);
      } else {
        setMode('taught');
        applyError(taught);
      }

      setLoading(false);
      setHasSearched(true);
      return;
    }

    if (forcedMode === null) {
      setMode('direct');
    }

    if (result.error === null && result.data !== null) {
      applyPage(result.data, nextPage);
    } else {
      applyError(result);
    }

    setLoading(false);
    setHasSearched(true);
  }

  function applyPage(
    data: {
      items: { enrollment_id: string; label: string; class_id: string }[];
      classes: { class_id: string; name: string }[];
      pagination: { page: number; total_pages: number; total_items: number };
      partialFailures: number;
    },
    nextPage: number
  ) {
    setItems(data.items);
    setClasses(data.classes);
    setPage(nextPage);
    setTotalPages(data.pagination.total_pages);
    setTotalItems(data.pagination.total_items);
    // The class step only makes sense against the page it was derived
    // from; a new page resets it instead of filtering by a stale class.
    setClassFilter('');

    if (data.partialFailures > 0) {
      setNotice(
        `Sebagian data tidak dapat dimuat (${data.partialFailures} sesi terlewat). Hasil di bawah hanya dari sesi yang berhasil dibaca.`
      );
    } else {
      setNotice('');
    }
  }

  function applyError(result: EnrollmentPickerResult) {
    if (result.error !== null && result.data === null) {
      setItems([]);
      setClasses([]);
      setClassFilter('');
      setTotalPages(0);
      setTotalItems(0);
      setNotice('');
      setError(result.message);
    }
  }

  // Search runs only on explicit actions (Cari button, pagination) — never
  // on mount and never per keystroke, following the ReportChatPicker
  // pattern: one request per member intent.
  //
  // Pagination walks the last *submitted* search, not the editable draft:
  // the displayed page/totalPages belong to `submittedQuery`, so editing
  // the input after Cari must not silently re-target page 2+ at the new
  // draft (skipping its page 1). Only Cari adopts the draft, always from
  // page 1.
  function handleSearch() {
    setSubmittedQuery(query);
    void runSearch(query, 1, mode);
  }

  const visibleItems =
    classFilter === '' ? items : items.filter((item) => item.class_id === classFilter);

  const searchId = `${dialogId}-student-search`;
  const classId = `${dialogId}-class-filter`;

  return (
    <div>
      <label
        htmlFor={searchId}
        className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
      >
        Siswa
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama siswa atau kelas"
          maxLength={255}
          autoComplete="off"
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          disabled={loading}
          onClick={handleSearch}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {loading ? 'Mencari…' : 'Cari'}
        </button>
      </div>

      {/* The chosen enrollment travels with the form under the exact field
          name the Server Action validates; the button below stays disabled
          until a choice exists, and the action rejects a forged id. */}
      <input type="hidden" name="enrollment_id" value={selectedId} />
      {selectedId && (
        <p className="mt-1.5 text-sm font-medium text-gray-700 dark:text-gray-200" role="status">
          Terpilih: {selectedLabel}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-1.5 text-sm text-amber-700 dark:text-amber-300">
          {notice}
        </p>
      )}

      {classes.length > 0 && !error && (
        <div className="mt-3">
          <label
            htmlFor={classId}
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Filter kelas (halaman ini)
          </label>
          <select
            id={classId}
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">Semua kelas di halaman ini</option>
            {classes.map((klass) => (
              <option key={klass.class_id} value={klass.class_id}>
                {klass.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!hasSearched && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Ketik nama siswa atau kelas lalu tekan Cari. Data diambil per halaman dari server.
        </p>
      )}
      {mode === 'taught' && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Pencarian di sini mencocokkan nama kelas di server. Cari kelas, lalu pilih siswa dari
          daftar di bawah.
        </p>
      )}

      {hasSearched && !loading && !error && visibleItems.length === 0 && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400" role="status">
          Tidak ada siswa yang cocok. Coba kata kunci lain atau halaman berikutnya.
        </p>
      )}

      {visibleItems.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {visibleItems.map((item) => {
            const active = item.enrollment_id === selectedId;

            return (
              <li key={item.enrollment_id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedId(item.enrollment_id);
                    setSelectedLabel(item.label);
                    onSelectionChange?.(true);
                  }}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 font-semibold text-blue-900 dark:text-blue-100'
                      : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  {active && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Pagination belongs to the fetched page metadata, not the visible
          row count: a Teacher session page may resolve zero selectable
          attendees (or lose every attendee read) while later session pages
          still exist. Hiding the controls there strands the member on an
          empty page the notice itself tells them to leave. */}
      {!error && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void runSearch(submittedQuery, page - 1, mode)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-60"
          >
            Sebelumnya
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-400" role="status">
            Halaman {page} dari {totalPages} · {totalItems} {mode === 'taught' ? 'sesi' : 'siswa'}
          </p>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => void runSearch(submittedQuery, page + 1, mode)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-60"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
