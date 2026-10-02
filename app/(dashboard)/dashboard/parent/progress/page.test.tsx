import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Render test for the parent progress portal (KEL-141).
 *
 * The page is a Server Component, so its queries are mocked and the rendered
 * markup is asserted, as in the enrollment history page test. What matters
 * for the acceptance criteria: a parent with two children sees a selector and
 * only the selected child's rows (AC1), empty lists render the empty copy
 * (AC2), and query failures render error states instead of throwing (AC5).
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' ? { name, value: 'session-token' } : undefined),
  })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const A = '123e4567-e89b-12d3-a456-426614174001';
const B = '123e4567-e89b-12d3-a456-426614174002';
const ENROLL_A = '223e4567-e89b-12d3-a456-426614174001';
const ENROLL_B = '223e4567-e89b-12d3-a456-426614174002';

const students = [
  { id: A, parent_id: 'parent-1', first_name: 'Budi' },
  { id: B, parent_id: 'parent-1', first_name: 'Sari' },
];
const enrollments = [
  { id: ENROLL_A, student_id: A, status: 'active' },
  { id: ENROLL_B, student_id: B, status: 'active' },
];

const getStudents = vi.fn();
const getEnrollmentHistory = vi.fn();
const getUpcomingSessions = vi.fn();
const getStudentAttendance = vi.fn();
const getStudentReports = vi.fn();

vi.mock('../students/_queries/queries', () => ({ getStudents: (...args: unknown[]) => getStudents(...args) }));
vi.mock('../enrollments/_queries/queries', () => ({
  getEnrollmentHistory: (...args: unknown[]) => getEnrollmentHistory(...args),
}));
vi.mock('./_queries/queries', () => ({
  getUpcomingSessions: (...args: unknown[]) => getUpcomingSessions(...args),
  getStudentAttendance: (...args: unknown[]) => getStudentAttendance(...args),
  getStudentReports: (...args: unknown[]) => getStudentReports(...args),
}));

const { default: ParentProgressPage } = await import('./page');

const okStudents = { data: { items: students }, error: null };
const okHistory = { data: { enrollments, transactions: [] }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  getStudents.mockResolvedValue(okStudents);
  getEnrollmentHistory.mockResolvedValue(okHistory);
});

function fullRows() {
  getUpcomingSessions.mockResolvedValue({
    data: [
      { id: 's1', enrollment_id: ENROLL_A, session_date: '2026-10-05', class: { name: 'Matematika Budi' } },
      { id: 's2', enrollment_id: ENROLL_B, session_date: '2026-10-06', class: { name: 'Fisika Sari' } },
    ],
    error: null,
  });
  getStudentAttendance.mockResolvedValue({
    data: [{ id: 'a1', enrollment_id: ENROLL_B, status: 'present', date: '2026-09-20' }],
    error: null,
  });
  getStudentReports.mockResolvedValue({
    data: [{ id: '323e4567-e89b-12d3-a456-426614174001', enrollment_id: ENROLL_B, title: 'Laporan Sari' }],
    error: null,
  });
}

function emptyRows() {
  getUpcomingSessions.mockResolvedValue({ data: [], error: null });
  getStudentAttendance.mockResolvedValue({ data: [], error: null });
  getStudentReports.mockResolvedValue({ data: [], error: null });
}

async function render(params: Record<string, string> = {}): Promise<string> {
  const node = await ParentProgressPage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(node);
}

describe('parent progress page', () => {
  it('shows the child selector and only the selected child rows (AC1)', async () => {
    getStudents.mockResolvedValue(okStudents);
    getEnrollmentHistory.mockResolvedValue(okHistory);
    fullRows();

    const html = await render({ student: B });

    expect(html).toContain('Pilih anak');
    expect(html).toContain('Budi');
    expect(html).toContain('Sari');
    expect(html).toContain('Fisika Sari');
    expect(html).toContain('Laporan Sari');
    expect(html).not.toContain('Matematika Budi');
  });

  it('falls back to the first child for a stale selector value', async () => {
    getStudents.mockResolvedValue(okStudents);
    getEnrollmentHistory.mockResolvedValue(okHistory);
    fullRows();

    const html = await render({ student: 'not-a-uuid' });

    expect(html).toContain('Matematika Budi');
    expect(html).not.toContain('Fisika Sari');
  });

  it('renders empty states when the child has no sessions, attendance, or reports (AC2)', async () => {
    getStudents.mockResolvedValue(okStudents);
    getEnrollmentHistory.mockResolvedValue(okHistory);
    emptyRows();

    const html = await render({ student: A });

    expect(html).toContain('Belum ada sesi mendatang untuk anak ini.');
    expect(html).toContain('Belum ada riwayat kehadiran untuk anak ini.');
    expect(html).toContain('Belum ada laporan untuk anak ini.');
  });

  it('invites the parent to add a child profile when there are no students', async () => {
    getStudents.mockResolvedValue({ data: { items: [] }, error: null });

    const html = await render();

    expect(html).toContain('Belum ada profil anak.');
    expect(html).toContain('/dashboard/parent/students');
    expect(getUpcomingSessions).not.toHaveBeenCalled();
  });

  it('renders error states instead of throwing (AC5)', async () => {
    getStudents.mockResolvedValue(okStudents);
    getEnrollmentHistory.mockResolvedValue(okHistory);
    getUpcomingSessions.mockResolvedValue({ data: null, error: 'api', message: 'Jadwal sesi mendatang belum dapat dimuat.' });
    getStudentAttendance.mockResolvedValue({ data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke data progres anak ini.' });
    getStudentReports.mockResolvedValue({ data: [], error: null });

    const html = await render({ student: A });

    expect(html).toContain('Jadwal sesi mendatang belum dapat dimuat.');
    expect(html).toContain('Anda tidak memiliki akses ke data progres anak ini.');
  });

  it('reports a forbidden student list as access denied', async () => {
    getStudents.mockResolvedValue({ data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke profil student ini.' });

    const html = await render();

    expect(html).toContain('Akses ditolak');
  });
});
