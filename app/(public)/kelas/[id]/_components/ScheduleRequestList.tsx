'use client';

import Link from 'next/link';
import { CancelScheduleRequestButton } from './CancelScheduleRequestButton';
import { ScheduleRequestChatButton } from '@/app/(dashboard)/dashboard/parent/chat/_components/ScheduleRequestChatButton';
import { AcceptRecommendationButton, DeclineRecommendationButton } from './ScheduleRecommendationActions';
import {
  findMatchingEnrollment,
  hasPendingRecommendation,
  scheduleRecommendationStatusLabel,
  scheduleRequestStatusLabel,
  scheduleSlotLabel,
  type EnrollmentLinkCandidate,
  type ScheduleRequest,
} from '@/lib/schedule-request';
import type { Student } from '@/lib/students';

const tones: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#815d00]',
  approved: 'bg-[#e9f5df] text-[#356318]',
  rejected: 'bg-[#fde9e7] text-[#9b2922]',
  declined: 'bg-[#fde9e7] text-[#9b2922]',
  cancelled: 'bg-[#eef3f1] text-[#365047]',
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Bulanan',
  quarterly: 'Per tiga bulan',
  yearly: 'Tahunan',
};

/**
 * Parent's schedule requests for the class being viewed (KEL-109, extended
 * KEL-116 with the recommendation round-trip).
 *
 * - Pending rows offer cancellation; the request stays listed as pending until
 *   the backend decides.
 * - Rejected rows show the tenant's reason when the backend sends one, plus a
 *   resubmit option that refills the same form above (via `onResubmit`).
 * - Rejected rows carrying `recommended_slots` additionally show the
 *   tenant-proposed slots: while the recommendation waits, the parent can
 *   accept it (redirect to payment) or decline it; a declined row states the
 *   outcome and offers no further recommendation action.
 * - Approved rows link to the matching enrollment on the enrollment status
 *   screen (KEL-53), matched via student + class; when no enrollment row is
 *   loaded the approval is shown without a link rather than a guessed one.
 */
export function ScheduleRequestList({
  requests,
  students,
  enrollments,
  onResubmit,
}: {
  requests: ScheduleRequest[];
  students: Student[];
  enrollments: EnrollmentLinkCandidate[];
  onResubmit?: (request: ScheduleRequest) => void;
}) {
  const studentName = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    return student?.first_name || 'Student';
  };

  return (
    <div className="mt-8 border-t border-[#e5e8df] pt-7" id="daftar-permintaan-jadwal">
      <h2 className="text-xl font-black">Permintaan jadwal Anda</h2>
      {requests.length ? (
        <ul className="mt-4 space-y-4" aria-label="Daftar permintaan jadwal">
          {requests.map((request) => {
            const match =
              request.status === 'approved' ? findMatchingEnrollment(request, enrollments) : null;
            return (
              <li key={request.id} className="rounded-2xl border border-[#dfe3d7] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black">
                      {studentName(request.student_id)} · {BILLING_CYCLE_LABELS[request.billing_cycle] || request.billing_cycle}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[#52615b]">
                      {request.slots.map((slot, index) => (
                        <li key={index}>{scheduleSlotLabel(slot) || 'Slot tidak valid'}</li>
                      ))}
                      {!request.slots.length && <li>Slot tidak tersedia</li>}
                    </ul>
                    {request.note && <p className="mt-2 text-sm text-[#52615b]">Catatan: {request.note}</p>}
                    {request.status === 'rejected' && request.rejection_reason && (
                      <p className="mt-2 text-sm font-medium text-[#8e2119]">
                        Alasan penolakan: {request.rejection_reason}
                      </p>
                    )}
                    {!!request.recommended_slots?.length && (
                      <div className="mt-2 rounded-xl bg-[#eef3dd] p-3 text-sm">
                        <p className="font-bold text-[#31463d]">Jadwal rekomendasi dari penyelenggara</p>
                        <ul className="mt-1 space-y-1 text-[#52615b]">
                          {request.recommended_slots.map((slot, index) => (
                            <li key={index}>{scheduleSlotLabel(slot) || 'Slot tidak valid'}</li>
                          ))}
                        </ul>
                        {hasPendingRecommendation(request) ? (
                          <>
                            <p className="mt-1 font-medium text-[#365047]">
                              {scheduleRecommendationStatusLabel('pending')}. Pilih salah satu:
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <AcceptRecommendationButton requestId={request.id} />
                              <DeclineRecommendationButton requestId={request.id} />
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 font-medium text-[#365047]">
                            {request.status === 'declined'
                              ? 'Anda menolak rekomendasi ini.'
                              : scheduleRecommendationStatusLabel('accepted')}
                          </p>
                        )}
                      </div>
                    )}
                    {request.status === 'approved' &&
                      (match ? (
                        <Link
                          className="mt-2 inline-block text-sm font-bold text-[#617c35] underline"
                          href={`/dashboard/parent/enrollments#enrollment-${match.id}`}
                        >
                          Lihat enrollment
                        </Link>
                      ) : (
                        <p className="mt-2 text-sm text-[#52615b]">
                          Permintaan disetujui. Enrollment Anda akan muncul di halaman status enrollment.
                        </p>
                      ))}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${tones[request.status] || tones.pending}`}>
                    {scheduleRequestStatusLabel(request.status)}
                  </span>
                </div>
                {request.status === 'pending' && (
                  <div className="mt-4">
                    <CancelScheduleRequestButton requestId={request.id} />
                  </div>
                )}
                <div className="mt-4">
                  <ScheduleRequestChatButton
                    requestId={request.id}
                    label="Chat dengan tenant"
                    chatPath="/dashboard/parent/chat"
                    className="min-h-11 rounded-xl border border-[#c8d0c5] bg-white px-4 text-sm font-bold text-[#31463d] hover:bg-[#f3f6ef]"
                  />
                </div>
                {request.status === 'rejected' && onResubmit && (
                  <button
                    type="button"
                    onClick={() => onResubmit(request)}
                    className="mt-4 min-h-11 rounded-xl border border-[#c8d0c5] bg-white px-4 text-sm font-bold text-[#31463d] hover:bg-[#f3f6ef]"
                  >
                    Ajukan ulang
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[#52615b]">Belum ada permintaan jadwal untuk kelas ini.</p>
      )}
    </div>
  );
}
