import { ApiError } from '@/lib/api/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ apiRequest }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { registerInvitation } from './actions';

describe('registerInvitation', () => {
	beforeEach(() => {
		apiRequest.mockReset();
		revalidatePath.mockReset();
	});

	it('posts the token and registration fields, then provides the login path', async () => {
		apiRequest.mockResolvedValue({ status: 'success' });
		const formData = new FormData();
		formData.set('token', 'invitation-token');
		formData.set('first_name', 'Ada');
		formData.set('last_name', 'Lovelace');
		formData.set('password', 'password');

		await expect(registerInvitation({ success: false, message: '' }, formData)).resolves.toEqual({ success: true, message: 'Registrasi berhasil. Silakan login.' });
		expect(apiRequest).toHaveBeenCalledWith('/api/v1/invitations/register', { method: 'POST', body: JSON.stringify({ token: 'invitation-token', first_name: 'Ada', last_name: 'Lovelace', password: 'password' }) });
	});

	it('does not call the API for a missing token', async () => {
		const formData = new FormData();
		formData.set('first_name', 'Ada');
		formData.set('last_name', 'Lovelace');
		formData.set('password', 'password');

		await expect(registerInvitation({ success: false, message: '' }, formData)).resolves.toEqual({ success: false, message: 'Nama dan password wajib valid.' });
		expect(apiRequest).not.toHaveBeenCalled();
	});

	it('explains used invitations without exposing token data', async () => {
		apiRequest.mockRejectedValue(new ApiError('token-value', 409));
		const formData = new FormData();
		formData.set('token', 'token-value');
		formData.set('first_name', 'Ada');
		formData.set('last_name', 'Lovelace');
		formData.set('password', 'password');

		await expect(registerInvitation({ success: false, message: '' }, formData)).resolves.toEqual({ success: false, message: 'Invitation sudah digunakan.' });
	});
});