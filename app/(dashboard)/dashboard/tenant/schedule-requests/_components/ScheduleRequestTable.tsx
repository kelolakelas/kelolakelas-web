import {
  scheduleRequestStatusLabel,
  scheduleSlotLabel,
} from '@/lib/schedule-request';
import {
  scheduleRequestBillingCycleLabel,
  scheduleRequestClassName,
  scheduleRequestStudentName,
  submittedAtLabel,
} from '../_lib/schema';
import type { TenantScheduleRequestRow } from '../_queries/queries';
import { ApproveScheduleRequestDialog } from './ApproveScheduleRequestDialog';
import { RejectScheduleRequestDialog } from './RejectScheduleRequestDialog';

/** Badge colours for the request lifecycle status. */
const STATUS_TONES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        STATUS_TONES[status] ??
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {scheduleRequestStatusLabel(status)}
    </span>
  );
}

function SlotList({ slots }: { slots: TenantScheduleRequestRow['request']['slots'] }) {
  if (slots.length === 0) {
    return <span className="text-xs text-gray-400">Slot tidak tersedia</span>;
  }

  return (
    <ul className="space-y-1">
      {slots.map((slot, index) => (
        <li key={index}>{scheduleSlotLabel(slot) || 'Slot tidak valid'}</li>
      ))}
    </ul>
  );
}

/**
 * Empty state shown when the filter matches nothing.
 *
 * The filter always carries a status (it defaults to the pending work queue),
 * so an empty list only means no request has that status. It is a legitimate
 * state of a working page, never an error.
 */
function EmptyState() {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        Tidak ada permintaan jadwal pada status ini
      </h3>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Ubah filter status untuk melihat permintaan jadwal lain.
      </p>
    </section>
  );
}

/**
 * Tenant work queue of private schedule requests (KEL-110).
 *
 * Rendered as cards on small screens and as a table from `md` up, matching the
 * enrollment overview on this dashboard. Only `pending` rows offer the approve
 * and reject dialogs; every other status is display-only. Rejected rows show
 * the tenant's own reason when one was recorded.
 *
 * The component is a Server Component: it receives already-fetched rows and
 * renders them. The approve/reject dialogs underneath are Client Components
 * bound to their row's Server Action.
 */
export function ScheduleRequestTable({ rows }: { rows: TenantScheduleRequestRow[] }) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Mobile stacked cards */}
      <div className="block space-y-3 md:hidden">
        {rows.map(({ request, className, student }) => (
          <article
            key={request.id}
            className="space-y-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {scheduleRequestStudentName(student)}
                </h4>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {scheduleRequestClassName(className)} ·{' '}
                  {scheduleRequestBillingCycleLabel(request.billing_cycle)}
                </p>
              </div>
              <StatusBadge status={request.status} />
            </div>

            <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs">
              <div>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  Slot yang diajukan
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  <SlotList slots={request.slots} />
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  Diajukan
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {submittedAtLabel(request.created_at)}
                  {request.parent_email ? ` · ${request.parent_email}` : ''}
                </span>
              </div>
              {request.note && (
                <p className="text-gray-600 dark:text-gray-300">Catatan: {request.note}</p>
              )}
              {request.status === 'rejected' && request.rejection_reason && (
                <p className="font-medium text-red-700 dark:text-red-300">
                  Alasan penolakan: {request.rejection_reason}
                </p>
              )}
            </div>

            {request.status === 'pending' && (
              <div className="flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                <ApproveScheduleRequestDialog
                  requestId={request.id}
                  studentName={scheduleRequestStudentName(student)}
                  idPrefix="mobile"
                />
                <RejectScheduleRequestDialog
                  requestId={request.id}
                  studentName={scheduleRequestStudentName(student)}
                  idPrefix="mobile"
                />
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
          <caption className="sr-only">
            Daftar permintaan jadwal private beserta status dan tindakannya
          </caption>
          <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Student
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Kelas
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Slot
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Status
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(({ request, className, student }) => (
              <tr
                key={request.id}
                className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
              >
                <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                  {scheduleRequestStudentName(student)}
                  <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                    Diajukan {submittedAtLabel(request.created_at)}
                  </span>
                  {request.parent_email && (
                    <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                      {request.parent_email}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {scheduleRequestClassName(className)}
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {scheduleRequestBillingCycleLabel(request.billing_cycle)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <SlotList slots={request.slots} />
                  {request.note && (
                    <span className="mt-1 block max-w-xs text-xs text-gray-500 dark:text-gray-400">
                      Catatan: {request.note}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={request.status} />
                  {request.status === 'rejected' && request.rejection_reason && (
                    <span className="mt-1 block max-w-xs text-xs text-gray-500 dark:text-gray-400">
                      Alasan penolakan: {request.rejection_reason}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {request.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <ApproveScheduleRequestDialog
                        requestId={request.id}
                        studentName={scheduleRequestStudentName(student)}
                        idPrefix="desktop"
                      />
                      <RejectScheduleRequestDialog
                        requestId={request.id}
                        studentName={scheduleRequestStudentName(student)}
                        idPrefix="desktop"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
