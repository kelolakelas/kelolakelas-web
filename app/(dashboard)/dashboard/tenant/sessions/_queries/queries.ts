import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Member, QueryResult, Session } from '@/lib/api/types';
import type { SessionAttendeesResponse } from '../_lib/schema';

function listQuery(options: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export async function getSessions(
  options: {
    page?: number;
    search?: string;
    status?: string;
    class_id?: string;
    date_from?: string;
    date_to?: string;
  } = {}
): Promise<QueryResult<Session[]>> {
  try {
    const response = await apiRequest<
      Session[] | { items: Session[]; pagination?: QueryResult<Session[]>['pagination'] }
    >(`/api/v1/sessions?${listQuery({ page: options.page || 1, page_size: 20, ...options })}`);
    return unwrapList(response.data);
  } catch (error) {
    return {
      data: [],
      error: error instanceof ApiError ? error.message : 'Session gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function getSession(id: string): Promise<QueryResult<Session | null>> {
  try {
    const response = await apiRequest<Session>(`/api/v1/sessions/${id}`);
    return { data: response.data || null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof ApiError ? error.message : 'Detail session gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function getTutors(): Promise<QueryResult<Member[]>> {
  try {
    const response = await apiRequest<Member[] | { items: Member[] }>(
      '/api/v1/tutors?page=1&page_size=100'
    );
    return unwrapList(response.data);
  } catch (error) {
    return {
      data: [],
      error: error instanceof ApiError ? error.message : 'Tutor gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function getSessionAttendees(
  sessionId: string
): Promise<QueryResult<SessionAttendeesResponse | null>> {
  try {
    const response = await apiRequest<SessionAttendeesResponse>(`/api/v1/sessions/${sessionId}/attendees`);
    return { data: response.data || null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof ApiError ? error.message : 'Peserta session gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}