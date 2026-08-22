import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { BillingTransaction, Enrollment, QueryResult, Student } from '@/lib/api/types';

function listParams(options: { page?: number; search?: string }): string {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: '20' });
  if (options.search?.trim()) params.set('search', options.search.trim());
  return params.toString();
}

export async function getParentStudents(options: { page?: number; search?: string } = {}): Promise<QueryResult<Student[]>> {
  try {
    const response = await apiRequest<Student[] | { items: Student[]; pagination?: QueryResult<Student[]>['pagination'] }>(`/api/v1/students?${listParams(options)}`, { includeTenant: false, requiresAuth: true });
    return unwrapList(response.data);
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Student gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getParentStudent(id: string): Promise<QueryResult<Student | null>> {
  try {
    const response = await apiRequest<Student>(`/api/v1/students/${id}`, { includeTenant: false, requiresAuth: true });
    return { data: response.data || null };
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.message : 'Detail student gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getParentEnrollments(options: { page?: number } = {}): Promise<QueryResult<Enrollment[]>> {
  try {
    const response = await apiRequest<Enrollment[] | { items: Enrollment[]; pagination?: QueryResult<Enrollment[]>['pagination'] }>(`/api/v1/enrollments?${listParams(options)}`, { includeTenant: false, requiresAuth: true });
    return unwrapList(response.data);
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Enrollment gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getParentTransactions(options: { page?: number } = {}): Promise<QueryResult<BillingTransaction[]>> {
  try {
    const response = await apiRequest<BillingTransaction[] | { items: BillingTransaction[]; pagination?: QueryResult<BillingTransaction[]>['pagination'] }>(`/api/v1/billing/transactions?${listParams(options)}`, { includeTenant: false, requiresAuth: true });
    return unwrapList(response.data);
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Riwayat transaksi gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getParentTransaction(id: string): Promise<QueryResult<BillingTransaction | null>> {
  if (!id.trim()) return { data: null, error: 'ID transaksi tidak valid.', status: 400 };
  try {
    const response = await apiRequest<BillingTransaction>(`/api/v1/billing/transactions/${encodeURIComponent(id)}`, { includeTenant: false, requiresAuth: true });
    return { data: response.data || null };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : undefined;
    const message = status === 401 ? 'Sesi Anda berakhir. Silakan login kembali.' : status === 404 ? 'Transaksi tidak ditemukan.' : 'Detail transaksi gagal dimuat. Coba lagi nanti.';
    return { data: null, error: message, status };
  }
}