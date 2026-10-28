import Link from 'next/link';

/** Parents can read/reply to existing report rooms; staff initiate them. */
export function ReportChatButton() {
  return (
    <div>
      <p className="mb-3 text-sm text-[#52615b]">
        Percakapan laporan dimulai oleh pengajar. Buka chat untuk melihat pesan
        laporan yang telah dibagikan dan membalasnya.
      </p>
      <Link
        href="/dashboard/parent/chat"
        className="inline-flex min-h-11 items-center rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white hover:bg-[#52702e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#617c35]"
      >
        Buka chat
      </Link>
    </div>
  );
}
