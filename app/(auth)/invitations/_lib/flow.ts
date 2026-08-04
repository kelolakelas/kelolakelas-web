import { ApiError } from '@/lib/api/errors';

export const INVITATION_VERIFY_PATH = '/invitations/verify';
export const INVITATION_REGISTER_PATH = '/invitations/register';

export function getInvitationToken(value: string | string[] | undefined): string | undefined {
	const token = Array.isArray(value) ? value[0] : value;
	return token?.trim() || undefined;
}

export function getInvitationRegisterHref(token: string): string {
	return `${INVITATION_REGISTER_PATH}?token=${encodeURIComponent(token)}`;
}

export function getInvitationErrorMessage(error: unknown, action: 'verify' | 'register'): string {
	if (error instanceof ApiError) {
		if (error.status === 400) return 'Token invitation tidak valid.';
		if (error.status === 404) return 'Invitation sudah kedaluwarsa atau tidak ditemukan.';
		if (error.status === 409) return 'Invitation sudah digunakan.';
		return error.message;
	}

	return action === 'verify' ? 'Invitation gagal diverifikasi. Silakan coba lagi.' : 'Registrasi invitation gagal. Silakan coba lagi.';
}