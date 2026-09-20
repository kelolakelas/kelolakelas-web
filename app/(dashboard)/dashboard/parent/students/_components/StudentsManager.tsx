'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogoutButton } from '@/app/(auth)/logout/_components/LogoutButton';
import { DeleteStudentButton } from './DeleteStudentButton';
import { StudentForm } from './StudentForm';
import { studentLastName, type Student, type StudentListData } from '@/lib/students';

function StudentCard({ student, onEdit }: { student: Student; onEdit: (student: Student) => void }) {
  const lastName = studentLastName(student);
  return (
    <article className="rounded-3xl border border-[#dfe3d7] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{student.first_name}{lastName ? ` ${lastName}` : ''}</h2>
          <p className="mt-1 text-sm text-[#65726c]">{student.nickname ? `Panggilan: ${student.nickname}` : 'Nama panggilan belum diisi'}</p>
        </div>
        <span className="rounded-full bg-[#eef4e8] px-3 py-1 text-xs font-bold text-[#52702e]">Student</span>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-[#edf0e9] pt-4 text-sm sm:grid-cols-2">
        <div><dt className="text-[#65726c]">Tanggal lahir</dt><dd className="font-semibold">{student.date_of_birth?.slice(0, 10) || 'Belum diisi'}</dd></div>
        <div><dt className="text-[#65726c]">Jenis kelamin</dt><dd className="font-semibold">{student.gender === 'female' ? 'Perempuan' : student.gender === 'male' ? 'Laki-laki' : 'Belum diisi'}</dd></div>
      </dl>
      <div className="mt-5 flex items-start justify-between gap-4 border-t border-[#edf0e9] pt-4">
        <button type="button" onClick={() => onEdit(student)} className="text-sm font-bold text-[#617c35] hover:underline">Edit profil</button>
        <DeleteStudentButton studentId={student.id} />
      </div>
    </article>
  );
}

export function StudentsManager({ data }: { data: StudentListData }) {
  const [form, setForm] = useState<'create' | Student | null>(null);
  const hasStudents = data.items.length > 0;

  return (
    <>
      <header className="flex flex-col gap-5 border-b border-[#dfe3d7] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/kelas" className="text-sm font-bold text-[#617c35] hover:underline">← Kembali ke katalog</Link>
          <p className="mt-6 text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Profil parent</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Student saya</h1>
          <p className="mt-3 max-w-2xl text-[#52615b]">Simpan profil student yang akan digunakan saat mendaftar kelas. Data ini hanya menampilkan student milik akun parent Anda.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setForm('create')} className="min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white hover:bg-[#31463d]">+ Tambah student</button>
          <LogoutButton className="min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-5 text-sm font-bold text-[#617c35] hover:bg-[#eef4e8]" />
        </div>
      </header>

      {form && <section className="mt-7" aria-label={form === 'create' ? 'Form tambah student' : 'Form edit student'}><StudentForm student={form === 'create' ? undefined : form} onCancel={() => setForm(null)} /></section>}

      {hasStudents ? (
        <section className="mt-8 grid gap-5 md:grid-cols-2" aria-label="Daftar student">
          {data.items.map((student) => <StudentCard key={student.id} student={student} onEdit={setForm} />)}
        </section>
      ) : (
        <section className="mt-8 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-10 text-center">
          <h2 className="text-2xl font-black">Belum ada profil student.</h2>
          <p className="mx-auto mt-2 max-w-md text-[#52615b]">Tambahkan student pertama agar dapat dipilih saat enrollment kelas.</p>
          <button type="button" onClick={() => setForm('create')} className="mt-5 min-h-11 rounded-xl bg-[#617c35] px-5 font-bold text-white hover:bg-[#52702e]">Buat profil pertama</button>
        </section>
      )}
    </>
  );
}
