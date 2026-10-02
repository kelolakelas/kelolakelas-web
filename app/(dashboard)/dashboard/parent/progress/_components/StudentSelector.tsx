'use client';

import { useRouter } from 'next/navigation';
import type { Student } from '@/lib/students';
import { studentLastName } from '@/lib/students';

function studentLabel(student: Student): string {
  const last = studentLastName(student);
  return `${student.first_name}${last ? ` ${last}` : ''}`;
}

/**
 * Child selector for the progress portal (KEL-141).
 *
 * A plain GET form over `?student=<id>` so the choice survives reload and
 * share; the server falls back to the first child when the value is stale
 * or foreign. Rendered only when the parent has more than one child.
 */
export function StudentSelector({
  students,
  selectedId,
}: {
  students: Student[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <form
      aria-label="Pilih anak"
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-wrap items-center gap-3"
    >
      <label htmlFor="progress-student" className="text-sm font-bold text-[#365047]">
        Anak
      </label>
      <select
        id="progress-student"
        name="student"
        value={selectedId}
        onChange={(event) => {
          const next = event.target.value;
          router.push(
            next
              ? `/dashboard/parent/progress?student=${encodeURIComponent(next)}`
              : '/dashboard/parent/progress',
          );
        }}
        className="min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-4 text-sm font-bold text-[#17231f]"
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {studentLabel(student)}
          </option>
        ))}
      </select>
    </form>
  );
}
