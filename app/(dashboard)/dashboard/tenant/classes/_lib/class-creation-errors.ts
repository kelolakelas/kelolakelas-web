/** Safe UI guidance from existing HTTP semantics; never render arbitrary server errors. */
export function classCreationFailure(status: number, serverMessage: unknown, requestId: string | null) {
  const messages: Record<number, string> = {
    400: 'Check the category, class details, active teachers, schedule times and capacity before saving again.',
    401: 'Your session has expired. Sign in again before saving. Your draft is still open.',
    403: 'Your account cannot save this configuration. Ask an administrator to check tenant access and category, class and schedule permissions.',
    409: 'This retry key belongs to a different request. Close and check the class list before starting another class.',
    429: 'Too many requests. Wait briefly before saving again. Your draft is preserved.',
    500: 'The server could not confirm the save. Retry the same request to check its result before creating another class.',
    502: 'A required service could not be reached. Wait for service recovery, then retry the same request to check its result.',
    503: 'A required service or membership check is unavailable. Wait briefly, then retry the same request to check its result.',
    504: 'The service timed out. The save result is unknown. Retry the same request to check whether it was saved.',
  };
  const validationMessages: Record<string, string> = {
    'substitute tutor must be an active member of this tenant': 'A selected teacher is no longer active in this tenant. Choose an active teacher before saving again.',
    'category not found': 'The selected category is no longer available. Choose a current category before saving again.',
    'category access forbidden': 'The selected category is unavailable for this tenant. Choose a current category before saving again.',
    'private classes cannot include initial schedules': 'Remove initial schedules from this private class; private lessons are scheduled after enrollment.',
  };
  const message = (status === 400 && typeof serverMessage === 'string' && Object.hasOwn(validationMessages, serverMessage) && validationMessages[serverMessage]) ||
    messages[status] || (status >= 200 && status < 300
      ? 'The server response was incomplete or unreadable. The save result is unknown. Retry the same request to check whether it was saved.'
      : 'Class setup could not be confirmed. Retry the same request to check its result.');
  // The gateway already returns X-Request-ID. Bound its shape before presenting it.
  const reference = requestId && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(requestId) ? ` Reference: ${requestId}.` : '';
  return { success: false, message: message + reference, retrySameRequest: ![400, 401, 403, 429].includes(status) };
}
