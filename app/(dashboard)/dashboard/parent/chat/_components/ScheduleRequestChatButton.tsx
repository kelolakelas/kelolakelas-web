'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createScheduleRequestChat } from '@/lib/chat-actions';

/**
 * Chat entry button for one private schedule request (KEL-124).
 *
 * Get-or-create lives in the chat-service: posting `{kind:
 * 'schedule_request', subject_id}` returns the existing conversation for the
 * same tenant/kind/subject, so pressing the button again on the same row
 * lands in the same room. A refusal (unknown id, another tenant's row, or a
 * member without `chat:manage`) surfaces as a "not found / no access"
 * message shown where the member is already looking. `chat:manage` itself is
 * enforced server-side by the chat-service and is never probed here, so the
 * button stays visible and the denial explains itself.
 */
export function ScheduleRequestChatButton({
  requestId,
  label,
  chatPath,
  className,
}: {
  requestId: string;
  label: string;
  /** Chat inbox route the button navigates to, e.g. `/dashboard/parent/chat`. */
  chatPath: string;
  className: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setBusy(true);
    setError('');
    const result = await createScheduleRequestChat(requestId);
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error || 'Layanan chat sedang tidak tersedia. Coba lagi nanti.');
      return;
    }
    router.push(`${chatPath}?conversation=${encodeURIComponent(result.data.id)}`);
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void open()} className={className}>
        {busy ? 'Membuka chat…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
