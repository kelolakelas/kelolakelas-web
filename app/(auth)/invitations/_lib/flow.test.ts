import { ApiError } from '@/lib/api/errors';
import { describe, expect, it } from 'vitest';
import { getInvitationErrorMessage, getInvitationRegisterHref, getInvitationToken } from './flow';

describe('invitation flow helpers', () => {
	it('normalizes the token query parameter without exposing empty values', () => {
		expect(getInvitationToken(' token-value ')).toBe('token-value');
		expect(getInvitationToken(['token-value'])).toBe('token-value');
		expect(getInvitationToken('   ')).toBeUndefined();
	});

	it('builds the canonical registration URL with an encoded token', () => {
		expect(getInvitationRegisterHref('token/value')).toBe('/invitations/register?token=token%2Fvalue');
	});

	it.each([
		[400, 'Token invitation tidak valid.'],
		[404, 'Invitation sudah kedaluwarsa atau tidak ditemukan.'],
		[409, 'Invitation sudah digunakan.'],
	])('maps token API error %s to a clear state', (status, message) => {
		expect(getInvitationErrorMessage(new ApiError('server detail', status), 'verify')).toBe(message);
	});
});