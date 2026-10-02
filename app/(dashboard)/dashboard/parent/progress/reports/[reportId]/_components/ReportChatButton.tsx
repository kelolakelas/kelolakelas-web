'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createReportChat } from '@/lib/chat-actions';

/**
 * Chat entry button for one report of the parent's own child (KEL-141).
 *
 * Get-or-create lives in the chat-service: posting `{kind: 'report',
 * subject_id}` returns the existing conversation for the same tenant and
 * report, so pressing the button again on the same report lands in the same
 * room. A refusal (unknown id, another parent's report, or missing
 * permission) is shown where the parent is already looking instead of
 * navigating away. Mirrors `ScheduleRequestChatButton` (KEL-124).
 */
export function ReportChatButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setBusy(true);
    setError('');
    const result = await createReportChat(reportId);
    setBusy(false);
    if (result.error || !result.data) {
      setError(result.error || 'Layanan chat sedang tidak tersedia. Coba lagi nanti.');
      return;
    }
    router.push(`/dashboard/parent/chat?conversation=${encodeURIComponent(result.data.id)}`);
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void open()}
        className="inline-block min-h-11 rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white hover:bg-[#52702e] disabled:opacity-60"
      >
        {busy ? 'Membuka chat…' : 'Diskusikan laporan ini via chat'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}
