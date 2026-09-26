import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ current: { success: false, message: '' } as Record<string, unknown> }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [state.current, vi.fn()],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../_actions/actions', () => ({ enrollInClass: vi.fn() }));

const { EnrollmentPanel } = await import('./EnrollmentPanel');
const { duplicateEnrollmentState } = await import('@/lib/enrollment');

const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const students = [{ id, first_name: 'Ana' }] as never;

function render() {
  return renderToStaticMarkup(<EnrollmentPanel classId={id} classType="private" isParent students={students} schedules={[]} idempotencyKey={id} />);
}

beforeEach(() => { state.current = { success: false, message: '' }; });

describe('EnrollmentPanel', () => {
  it('shows the duplicate enrollment message with a link to the parent enrollments page', () => {
    state.current = duplicateEnrollmentState;
    const html = render();
    expect(html).toContain('Student ini sudah terdaftar atau masih memiliki pembayaran tertunda di kelas ini.');
    expect(html).toContain('href="/dashboard/parent/enrollments"');
    expect(html).toContain('Lihat status enrollment');
    expect(html).toContain('role="alert"');
  });

  it('shows a generic conflict message without the enrollment link', () => {
    state.current = { success: false, message: 'Jadwal penuh atau enrollment ini sudah berubah. Pilih jadwal lain atau gunakan checkout yang sama.' };
    const html = render();
    expect(html).toContain('Jadwal penuh atau enrollment ini sudah berubah.');
    expect(html).not.toContain('href="/dashboard/parent/enrollments"');
  });
});
