import { apiRequest } from '@/lib/api/client';
import Link from 'next/link';
import { getInvitationErrorMessage, getInvitationRegisterHref, getInvitationToken, INVITATION_VERIFY_PATH } from '../_lib/flow';

export default async function InvitationVerifyPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
	const { token: rawToken } = await searchParams;
	const token = getInvitationToken(rawToken);
	if (!token) return <main className="mx-auto max-w-lg p-6"><h1 className="text-2xl font-bold">Invitation tidak valid</h1><p className="mt-2 text-sm text-gray-600">Token invitation tidak ditemukan.</p></main>;
	let email: string | undefined;
	let errorMessage: string | undefined;
	try {
		const response = await apiRequest<{ email?: string }>(`/api/v1/invitations/verify?token=${encodeURIComponent(token)}`);
		email = response.data?.email;
	} catch (error) {
		errorMessage = getInvitationErrorMessage(error, 'verify');
	}
	if (errorMessage) return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-bold">Invitation tidak dapat digunakan</h1><p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p><Link href={INVITATION_VERIFY_PATH} className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">Coba invitation lain</Link></main>;
	return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-bold">Invitation terverifikasi</h1><p className="text-sm text-gray-600">Invitation untuk {email || 'akun Anda'} siap digunakan.</p><Link href={getInvitationRegisterHref(token)} className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Lanjut registrasi</Link></main>;
}