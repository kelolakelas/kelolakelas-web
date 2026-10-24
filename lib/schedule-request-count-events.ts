export const SCHEDULE_REQUEST_COUNT_REFRESH = 'kelolakelas:schedule-request-count-refresh';

/** Invalidate only: all numbers are reconciled against the authenticated backend. */
export function notifyScheduleRequestCountChanged() {
  window.dispatchEvent(new Event(SCHEDULE_REQUEST_COUNT_REFRESH));
}
