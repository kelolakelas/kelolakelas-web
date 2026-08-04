'use client';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { registerInvitation, type InvitationActionResponse } from '../_actions/actions';

const inputClassName = 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-950 shadow-sm outline-none placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100';

export function RegistrationForm({ token }: { token: string }) {
	const router = useRouter();
	const [state, action, pending] = useActionState(registerInvitation, { success: false, message: '' } satisfies InvitationActionResponse);

	useEffect(() => {
		if (state.success) router.push('/login');
	}, [state.success, router]);

	return (
		<form action={action} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8" aria-labelledby="invitation-form-title">
			<input type="hidden" name="token" value={token} />
			<div className="mb-7 border-b border-slate-200 pb-6">
				<p className="text-sm font-semibold text-indigo-700">Langkah terakhir</p>
				<h2 id="invitation-form-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Buat akun Anda</h2>
				<p className="mt-2 text-sm leading-6 text-slate-600">Isi data berikut untuk mengaktifkan akses Anda.</p>
			</div>

			{state.message && (
				<div role={state.success ? 'status' : 'alert'} className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${state.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
					{state.success && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
					<p>{state.message}</p>
				</div>
			)}

			<div className="grid gap-5 sm:grid-cols-2">
				<div>
					<label htmlFor="first_name" className="mb-2 block text-sm font-semibold text-slate-800">Nama depan</label>
					<input id="first_name" name="first_name" autoComplete="given-name" required className={inputClassName} placeholder="Contoh: Siti" />
				</div>
				<div>
					<label htmlFor="last_name" className="mb-2 block text-sm font-semibold text-slate-800">Nama belakang</label>
					<input id="last_name" name="last_name" autoComplete="family-name" required className={inputClassName} placeholder="Contoh: Aminah" />
				</div>
			</div>

			<div className="mt-5">
				<label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">Kata sandi</label>
				<input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required aria-describedby="password-hint" className={inputClassName} placeholder="Minimal 6 karakter" />
				<p id="password-hint" className="mt-2 text-xs leading-5 text-slate-500">Gunakan kata sandi yang mudah Anda ingat dan tidak dibagikan kepada orang lain.</p>
			</div>

			<div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
				<Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Sudah punya akun?</Link>
				<button type="submit" disabled={pending} aria-disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36">
					{pending ? 'Mendaftarkan...' : 'Buat akun'}
					{!pending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
				</button>
			</div>
		</form>
	);
}