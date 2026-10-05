import {
  reportClassName,
  reportDateLabel,
  reportScoreLabel,
  reportStudentName,
} from '../_lib/schema';
import type { TenantReportRow } from '../_queries/queries';
import { ReportDeleteDialog } from './ReportDeleteDialog';
import { ReportFormDialog } from './ReportFormDialog';

/**
 * Fallback shown instead of the write dialogs when the member lacks the
 * matching `report:*` permission (KEL-139).
 *
 * The backend stays the access authority — the actions refuse the mutation
 * with the same permission — this panel only decides what the dashboard
 * offers, so the member is told about the missing permission instead of
 * meeting a technical error after submitting.
 */
function ReportWriteForbiddenPanel({ permission }: { permission: string }) {
  return (
    <p className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
      Anda tidak memiliki izin mengelola laporan ini. Hubungi administrator tenant untuk mendapatkan
      permission {permission}.
    </p>
  );
}

/**
 * One student evaluation report with its student, class, score, and notes
 * (KEL-139).
 *
 * The update and delete dialogs are offered per action permission: a tutor
 * who does not teach the report's class sees the same assignment message
 * from the Server Action after submitting, because only the backend knows
 * the assignment. The score badge reads "Belum dinilai" when no score was
 * given rather than hiding the report.
 */
export function ReportCard({
  row,
  canUpdate,
  canDelete,
  idPrefix,
}: {
  row: TenantReportRow;
  canUpdate: boolean;
  canDelete: boolean;
  idPrefix: string;
}) {
  const { report } = row;
  const enrollment = report.enrollment ?? null;

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{report.title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {reportStudentName(enrollment?.student ?? null)} · {reportClassName(enrollment)} ·{' '}
            {reportDateLabel(report.created_at)}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          {reportScoreLabel(report.score)}
        </span>
      </div>

      {typeof report.evaluation_notes === 'string' && report.evaluation_notes.trim() !== '' && (
        <p className="mt-3 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
          {report.evaluation_notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {canUpdate ? (
          <ReportFormDialog
            mode="update"
            report={report}
            enrollment={enrollment}
            enrollmentOptions={[]}
            idPrefix={idPrefix}
          />
        ) : (
          <ReportWriteForbiddenPanel permission="report:update" />
        )}
        {canDelete ? (
          <ReportDeleteDialog reportId={report.id} reportTitle={report.title} idPrefix={idPrefix} />
        ) : (
          <ReportWriteForbiddenPanel permission="report:delete" />
        )}
      </div>
    </article>
  );
}
