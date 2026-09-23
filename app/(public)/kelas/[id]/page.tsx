import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { CalendarDays, MapPin } from 'lucide-react';
import { descriptionText, formatPrice, getCatalogClass, scheduleLabels, scheduleOptions } from '@/lib/catalog';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import { getStudents } from '@/app/(dashboard)/dashboard/parent/students/_queries/queries';
import type { Student } from '@/lib/students';
import { EnrollmentPanel } from './_components/EnrollmentPanel';
import { classDetailMetadata } from '@/lib/site-metadata';

type Props = { params: Promise<{ id: string }> };

// getCatalogClass uses fetch, so this lookup is memoized with the page's own request for the same class.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return classDetailMetadata(id, await getCatalogClass(id));
}

export default async function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await getCatalogClass(id);
  if (result.error === 'not_found') return <main className="mx-auto min-h-screen max-w-5xl px-5 py-16"><h1 className="text-3xl font-black">Kelas tidak ditemukan</h1><p className="mt-3 text-[#52615b]">Kelas mungkin sudah tidak dipublikasikan.</p><Link className="mt-6 inline-block font-bold underline" href="/kelas">Kembali ke katalog</Link></main>;
  if (result.error || !result.data) return <main className="mx-auto min-h-screen max-w-5xl px-5 py-16"><h1 className="text-3xl font-black">Detail belum dapat dimuat</h1><p className="mt-3 text-[#52615b]">Terjadi masalah saat menghubungi katalog.</p><Link className="mt-6 inline-block font-bold underline" href="/kelas">Kembali ke katalog</Link></main>;
  const item = result.data; const schedules = scheduleLabels(item.schedules); const scheduleChoices = scheduleOptions(item.schedules); const description = descriptionText(item.description);
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  const session = getSessionIdentityFromToken(token);
  let students: Student[] = [];
  let studentError: string | undefined;
  if (session?.isParent) {
    const studentResult = await getStudents();
    if (studentResult.error) studentError = studentResult.message;
    else students = studentResult.data.items;
  }
  return <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8"><article className="mx-auto max-w-5xl"><Link className="font-bold text-[#617c35] hover:underline" href="/kelas">← Semua kelas</Link><div className="mt-8 rounded-[2rem] border border-[#dfe3d7] bg-white p-7 sm:p-12"><p className="font-bold text-[#617c35]">{item.category_name} · {item.type}</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-6xl">{item.name}</h1><p className="mt-4 text-lg font-semibold text-[#52615b]">{item.tenant_name}</p>{item.tenant_address && <p className="mt-2 flex gap-2 text-[#52615b]"><MapPin size={18} />{item.tenant_address}</p>}{description && <p className="mt-7 max-w-3xl leading-7 text-[#52615b]">{description}</p>}<p className="mt-8 text-3xl font-black">{formatPrice(item.price)}</p><div className="mt-10 border-t border-[#e5e8df] pt-7"><h2 className="text-xl font-black">Jadwal</h2>{schedules.length ? <ul className="mt-3 space-y-2">{schedules.map(schedule => <li className="flex gap-2 text-[#52615b]" key={schedule}><CalendarDays size={18} />{schedule}</li>)}</ul> : <p className="mt-3 text-[#52615b]">Jadwal belum tersedia secara lengkap. Hubungi penyelenggara untuk konfirmasi.</p>}</div><p className="mt-9 rounded-2xl bg-[#eef3dd] p-4 font-medium">{item.is_enrollable ? 'Kelas ini menerima pendaftaran.' : 'Kelas ini saat ini belum menerima pendaftaran.'}</p><EnrollmentPanel classId={id} classType={item.type} isParent={Boolean(session?.isParent)} students={students} schedules={scheduleChoices} idempotencyKey={randomUUID()} studentError={studentError} /></div></article></main>;
}
