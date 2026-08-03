import { z } from 'zod';

const isoDateTime = z.string().trim().min(1, 'Waktu wajib diisi.');

export const rescheduleSessionSchema = z.object({
  sessionId: z.string().uuid('ID session tidak valid.'),
  newSessionDate: z.string().trim().min(1, 'Tanggal session wajib diisi.'),
  newStartTime: isoDateTime,
  newEndTime: isoDateTime,
  newLocation: z.string().trim().optional(),
}).refine((value) => value.newStartTime < value.newEndTime, {
  message: 'Waktu selesai harus setelah waktu mulai.',
  path: ['newEndTime'],
});

export const substituteTutorSchema = z.object({
  sessionId: z.string().uuid('ID session tidak valid.'),
  substituteTutorId: z.string().uuid('ID tutor pengganti tidak valid.'),
});

export interface SessionAttendee {
  id?: string;
  student_id?: string;
  status?: string;
  joined_at?: string;
  student?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

export interface SessionAttendeesResponse {
  session_id: string;
  class_id: string;
  attendees: SessionAttendee[];
}

export interface SessionActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}