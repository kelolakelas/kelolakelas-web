// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Behaviour test for the KEL-167 report create-form student picker.
 *
 * The picker never fetches on mount: the first explicit search probes the
 * direct enrollment list (`enrollment:read`, Creator path) and falls back
 * to the taught-session lookup (`schedule:read`, Teacher path) when the
 * direct list refuses with `forbidden`. Search runs only on explicit
 * actions (Cari, pagination) — one backend page per intent — following the
 * `ReportChatPicker` pattern. Choosing a student fills the hidden
 * `enrollment_id` field (the exact name the Server Action validates) and
 * reports the selection to the dialog, which enables the submit.
 */

const mocks = vi.hoisted(() => ({
  searchDirectEnrollments: vi.fn(),
  searchTaughtEnrollments: vi.fn(),
  onSelectionChange: vi.fn(),
}));

vi.mock('../_actions/enrollment-search', () => ({
  searchDirectEnrollments: mocks.searchDirectEnrollments,
  searchTaughtEnrollments: mocks.searchTaughtEnrollments,
}));

const { EnrollmentPicker } = await import('./EnrollmentPicker');

const ENROLLMENT_A = 'c0ffee00-1111-4222-8333-444455556666';

function directPage(
  items: { enrollment_id: string; label: string; class_id: string }[],
  page = 1,
  totalPages = 1
) {
  return {
    items: items.map((item) => ({ ...item, class_name: 'Matematika Dasar' })),
    classes: [{ class_id: 'class-1', name: 'Matematika Dasar' }],
    pagination: { page, page_size: 100, total_items: items.length, total_pages: totalPages },
    partialFailures: 0,
  };
}

beforeEach(() => {
  mocks.searchDirectEnrollments.mockReset();
  mocks.searchTaughtEnrollments.mockReset();
  mocks.onSelectionChange.mockClear();
  mocks.searchDirectEnrollments.mockResolvedValue({
    data: directPage([{ enrollment_id: ENROLLMENT_A, label: 'Budi Santoso · Matematika Dasar', class_id: 'class-1' }]),
    error: null,
  });
});

afterEach(() => cleanup());

describe('EnrollmentPicker', () => {
  it('fetches nothing on mount and searches on Cari', async () => {
    render(<EnrollmentPicker dialogId="test-picker" onSelectionChange={mocks.onSelectionChange} />);

    expect(mocks.searchDirectEnrollments).not.toHaveBeenCalled();
    expect(mocks.searchTaughtEnrollments).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'budi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await waitFor(() => expect(mocks.searchDirectEnrollments).toHaveBeenCalledWith('budi', 1));
    expect(await screen.findByText('Budi Santoso · Matematika Dasar')).toBeTruthy();
  });

  it('falls back to the taught lookup when the direct list refuses', async () => {
    mocks.searchDirectEnrollments.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki izin membaca enrollment.',
    });
    mocks.searchTaughtEnrollments.mockResolvedValue({
      data: directPage([{ enrollment_id: ENROLLMENT_A, label: 'Budi Santoso · Matematika Dasar', class_id: 'class-1' }]),
      error: null,
    });

    render(<EnrollmentPicker dialogId="test-picker" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await waitFor(() => expect(mocks.searchDirectEnrollments).toHaveBeenCalledWith('', 1));
    await waitFor(() => expect(mocks.searchTaughtEnrollments).toHaveBeenCalledWith('', 1));
    expect(await screen.findByText('Budi Santoso · Matematika Dasar')).toBeTruthy();
    expect(screen.getByText(/mencocokkan nama kelas/)).toBeTruthy();
  });

  it('fills the hidden enrollment field and enables the dialog on choice', async () => {
    const { container } = render(
      <EnrollmentPicker dialogId="test-picker" onSelectionChange={mocks.onSelectionChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
    fireEvent.click(await screen.findByRole('button', { name: /Budi Santoso/ }));

    const hidden = container.querySelector('input[type="hidden"][name="enrollment_id"]');
    expect((hidden as HTMLInputElement).value).toBe(ENROLLMENT_A);
    expect(mocks.onSelectionChange).toHaveBeenCalledWith(true);
  });

  it('walks pages and reports the current position', async () => {
    mocks.searchDirectEnrollments
      .mockResolvedValueOnce({
        data: directPage(
          [{ enrollment_id: ENROLLMENT_A, label: 'Siswa halaman satu', class_id: 'class-1' }],
          1,
          2
        ),
        error: null,
      })
      .mockResolvedValueOnce({
        data: directPage(
          [{ enrollment_id: ENROLLMENT_A, label: 'Siswa halaman dua', class_id: 'class-1' }],
          2,
          2
        ),
        error: null,
      });

    render(<EnrollmentPicker dialogId="test-picker" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
    await screen.findByText('Siswa halaman satu');
    expect(screen.getByRole('status').textContent).toContain('Halaman 1 dari 2');

    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));

    await waitFor(() => expect(mocks.searchDirectEnrollments).toHaveBeenCalledWith('', 2));
    expect(await screen.findByText('Siswa halaman dua')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Halaman 2 dari 2');
  });

  it('explains an empty result instead of rendering nothing', async () => {
    mocks.searchDirectEnrollments.mockResolvedValue({
      data: directPage([]),
      error: null,
    });

    render(<EnrollmentPicker dialogId="test-picker" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    expect(await screen.findByText(/Tidak ada siswa yang cocok/)).toBeTruthy();
  });

  it('shows a revoked permission inline instead of an empty list', async () => {
    mocks.searchDirectEnrollments.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki izin membaca enrollment.',
    });
    mocks.searchTaughtEnrollments.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki izin membaca sesi mengajar.',
    });

    render(<EnrollmentPicker dialogId="test-picker" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki izin');
  });

  it('announces partial attendee failures without hiding the page', async () => {
    mocks.searchDirectEnrollments.mockResolvedValue({
      data: {
        ...directPage([
          { enrollment_id: ENROLLMENT_A, label: 'Budi Santoso · Matematika Dasar', class_id: 'class-1' },
        ]),
        partialFailures: 2,
      },
      error: null,
    });

    render(<EnrollmentPicker dialogId="test-picker" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    expect(await screen.findByText(/Sebagian data tidak dapat dimuat \(2 sesi terlewat\)/)).toBeTruthy();
    expect(await screen.findByText('Budi Santoso · Matematika Dasar')).toBeTruthy();
  });
});
