'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createReportChat } from '@/lib/chat-actions';
import { searchTenantReports } from '../_actions/actions';
import type { TenantReport, TenantReportList } from '../_queries/queries';

function reportDateLabel(createdAt: string | null): string {
  if (!createdAt) return '—';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/**
 * Searchable, paginated report picker that starts a `report` conversation
 * with the student's parent (KEL-124).
 *
 * Rendered only after the server probe confirmed `report:read`; every later
 * page/search re-checks through the same reader, so a revoked permission
 * mid-session surfaces its message instead of a silent empty list.
 * Get-or-create lives server-side, so starting twice from the same row
 * returns the same conversation and the parent sees it in their inbox.
 */
export function ReportChatPicker({ initial }: { initial: TenantReportList }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<TenantReportList>(initial);
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load(search: string, page: number) {
    setSearching(true);
    setError('');
    const result = await searchTenantReports(search, page);
    setSearching(false);
    if (result.error || !result.data) {
      setError(
        result.error
          ? result.message
          : 'Daftar laporan belum dapat dimuat. Coba lagi nanti.'
      );
      return;
    }
    setList(result.data);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query, 1);
  }

  async function start(report: TenantReport) {
    setStartingId(report.id);
    setError('');
    const result = await createReportChat(report.id);
    setStartingId(null);
    if (result.error || !result.data) {
      setError(
        result.error || 'Layanan chat sedang tidak tersedia. Coba lagi nanti.'
      );
      return;
    }
    router.push(
      `/dashboard/tenant/chat?conversation=${encodeURIComponent(result.data.id)}`
    );
  }

  const page = list.pagination.page >= 1 ? list.pagination.page : 1;
  const totalPages = list.pagination.total_pages;

  return (
    <section
      aria-label="Chat dari laporan"
      className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <h2 className="text-lg font-bold">Chat dari laporan student</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Pilih laporan untuk memulai percakapan dengan parent student.
      </p>

      <form
        onSubmit={submit}
        className="mt-4 flex flex-wrap gap-2"
        role="search"
      >
        <label htmlFor="report-chat-search" className="sr-only">
          Cari laporan
        </label>
        <input
          id="report-chat-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari judul laporan"
          maxLength={255}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-950"
        />
        <button
          type="submit"
          disabled={searching}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
        >
          {searching ? 'Mencari…' : 'Cari'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {list.items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Belum ada laporan yang cocok.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {list.items.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {report.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {reportDateLabel(report.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={startingId === report.id}
                  onClick={() => void start(report)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
                >
                  {startingId === report.id ? 'Membuka chat…' : 'Mulai chat'}
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={searching || page <= 1}
                onClick={() => void load(query, page - 1)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                Sebelumnya
              </button>
              <p
                className="text-sm text-gray-600 dark:text-gray-400"
                role="status"
              >
                Halaman {page} dari {totalPages}
              </p>
              <button
                type="button"
                disabled={searching || page >= totalPages}
                onClick={() => void load(query, page + 1)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
