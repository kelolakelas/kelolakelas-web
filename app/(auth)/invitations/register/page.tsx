import { ClipboardCheck, ShieldCheck } from 'lucide-react';
import { RegistrationForm } from '../_components/RegistrationForm';
import { getInvitationToken } from '../_lib/flow';

export default async function InvitationRegisterPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
	const { token: rawToken } = await searchParams;
	const token = getInvitationToken(rawToken);
	return (
		<main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-16">
			<div className="mx-auto grid w-full max-w-5xl items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
				<section className="pt-2 lg:pt-10">
					<div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
						<ClipboardCheck className="h-6 w-6" aria-hidden="true" />
					</div>
					<p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">Akses invitation</p>
					<h1 className="max-w-md text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Lengkapi profil untuk bergabung.</h1>
					<p className="mt-4 max-w-md text-base leading-7 text-slate-600">Buat akun Anda untuk melanjutkan ke ruang belajar yang sudah mengundang Anda.</p>
					<div className="mt-8 flex items-start gap-3 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-600">
						<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
						<p>Data Anda diproses dengan aman dan hanya digunakan untuk membuat akun.</p>
					</div>
				</section>

				<section aria-labelledby="invitation-form-title">
					{token ? <RegistrationForm token={token} /> : <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8"><h2 id="invitation-form-title" className="text-xl font-bold text-slate-950">Invitation tidak ditemukan</h2><p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">Token invitation tidak ditemukan. Buka kembali link invitation dari email Anda.</p></div>}
				</section>
			</div>
		</main>
	);
}