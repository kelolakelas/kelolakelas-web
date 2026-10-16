import { getTenantReports } from '../_queries/queries';
import { ReportChatPicker } from './ReportChatPicker';

/**
 * Report-to-chat entry section on the tenant chat page (KEL-124).
 *
 * Probes `GET /api/v1/reports` once on the server: a member without
 * `report:read` gets `forbidden` and the whole section stays hidden, so
 * requirement 4 ("anggota tanpa `report:read` tidak melihat pemilih
 * report") holds without ever flashing the control. A genuine outage shows
 * a retryable message instead; only the readable list mounts the picker.
 */
export async function ReportChatStarter() {
  const result = await getTenantReports({ search: '', page: 1 });

  if (result.error === 'forbidden') return null;

  if (result.error) {
    return (
      <section
        aria-label="Chat dari laporan"
        className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 className="text-lg font-bold">Chat dari laporan student</h2>
        <p
          role="alert"
          className="mt-2 text-sm text-gray-600 dark:text-gray-400"
        >
          {result.message}
        </p>
      </section>
    );
  }

  return <ReportChatPicker initial={result.data} />;
}
