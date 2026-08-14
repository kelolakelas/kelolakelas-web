import { ApiError } from '@/lib/api/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest, revalidatePath, getCookie } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  revalidatePath: vi.fn(),
  getCookie: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiRequest,
  getAuthCookieName: () => 'auth_token',
}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ get: getCookie }) }));

import { deleteStudent, saveStudent } from './actions';

function token(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe('parent student actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: token({ user_id: 'parent-1', is_parent: true }) });
  });

  it('creates a student with the Swagger payload and server-side parent id', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success' });
    const result = await saveStudent(undefined, form({ first_name: 'Alya', last_name: 'Putri', nickname: 'Alya', gender: 'female', date_of_birth: '2015-04-10', note_type: 'academic', note_content: 'Suka membaca' }));
    expect(result.success).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/students', expect.objectContaining({ method: 'POST', includeTenant: false, requiresAuth: true, body: JSON.stringify({ first_name: 'Alya', last_name: 'Putri', nickname: 'Alya', gender: 'female', date_of_birth: '2015-04-10', student_notes: [{ content: 'Suka membaca', note_type: 'academic' }], parent_id: 'parent-1' }) }));
  });

  it('updates without accepting parent id from the form', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success' });
    await saveStudent(undefined, form({ id: 'student-1', parent_id: 'attacker-parent', first_name: 'Alya', last_name: '', nickname: '', gender: '', date_of_birth: '2015-04-10' }));
    const request = apiRequest.mock.calls[0];
    expect(request[0]).toBe('/api/v1/students/student-1');
    expect(JSON.parse(request[1].body)).not.toHaveProperty('parent_id');
  });

  it('does not call the API for invalid input', async () => {
    const result = await saveStudent(undefined, form({ first_name: '', date_of_birth: '2030-01-01' }));
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('maps an active enrollment conflict during delete', async () => {
    apiRequest.mockRejectedValueOnce(new ApiError('conflict', 409));
    const result = await deleteStudent(undefined, form({ id: 'student-1' }));
    expect(result).toEqual({ success: false, message: 'Student tidak dapat dihapus karena masih memiliki enrollment aktif.' });
  });
});