import type { ScheduleTeachersRead } from '../_lib/teachers';

export function TeacherLoadStatus({
  read,
  loading,
  retry,
  id,
  readyMessage = 'Choose an active Teacher.',
}: {
  read: ScheduleTeachersRead | null;
  loading: boolean;
  retry: () => void;
  id?: string;
  readyMessage?: string;
}) {
  const error = read?.state === 'error';
  return (
    <div
      aria-busy={loading}
      className="space-y-2 text-xs text-gray-600 dark:text-gray-300"
    >
      <p
        id={id}
        role={error && !loading ? 'alert' : undefined}
        aria-live="polite"
      >
        {loading
          ? error
            ? 'Retrying teachers…'
            : 'Loading teachers…'
          : read?.state === 'forbidden'
            ? 'You do not have permission to read members. Ask a tenant administrator.'
            : error
              ? 'Unable to load teachers. Retry to keep working on this draft.'
              : read?.state === 'ok' && read.teachers.length === 0
                ? 'No active Teacher members. Add or activate a Teacher in Members first.'
                : readyMessage}
      </p>
      {error && (
        <button
          type="button"
          disabled={loading}
          onClick={retry}
          className="min-h-[44px] rounded-xl border px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Retry teachers
        </button>
      )}
    </div>
  );
}
