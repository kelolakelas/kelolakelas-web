// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Regression tests for the KEL-167 picker pagination ownership (fix-r1 + fix-r2).
 *
 * Pagination belongs to the fetched page metadata, not the visible row
 * count: a Teacher session page may resolve zero selectable attendees
 * (including losing every attendee read) while later session pages still
 * exist. These tests prove the member can walk past such an empty page —
 * clicking Berikutnya fetches the next session page and allows selection —
 * instead of only asserting the buttons render.
 *
 * Pagination also belongs to the last *submitted* search, not the editable
 * draft (fix-r2): editing the input after Cari must not silently re-target
 * page 2+ at the new draft. Loading serializes requests (buttons disable
 * while a fetch is in flight, so a second Cari fires nothing new); the
 * requestId race guard stays as defense-in-depth behind that.
 */
const mocks = vi.hoisted(() => ({ direct: vi.fn(), taught: vi.fn() }));
vi.mock('../_actions/enrollment-search', () => ({
  searchDirectEnrollments: mocks.direct,
  searchTaughtEnrollments: mocks.taught,
}));
const { EnrollmentPicker } = await import('./EnrollmentPicker');

const ENROLLMENT_B = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';

function taughtPage(
  items: { enrollment_id: string; label: string; class_id: string }[],
  page: number,
  totalPages: number,
  partialFailures = 0
) {
  return {
    error: null,
    data: {
      items,
      classes: [],
      partialFailures,
      pagination: { page, page_size: 100, total_items: 1101, total_pages: totalPages },
    },
  };
}

beforeEach(() => {
  mocks.direct.mockReset();
  mocks.taught.mockReset();
  // Teacher path: no `enrollment:read`, so the first probe refuses and the
  // picker falls back to the taught-session lookup.
  mocks.direct.mockResolvedValue({ data: null, error: 'forbidden', message: 'Forbidden' });
});

afterEach(cleanup);

it('paginates the submitted search rather than an unsubmitted input edit', async () => {
  mocks.direct.mockResolvedValue(taughtPage([], 1, 12));
  render(<EnrollmentPicker dialogId="submitted-query" />);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Lama' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText(/Halaman 1 dari 12/);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Baru' } });
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() => expect(mocks.direct).toHaveBeenLastCalledWith('Kelas Lama', 2));
});

it('walks both directions with the same submitted search', async () => {
  mocks.direct
    .mockResolvedValueOnce(taughtPage([], 1, 3))
    .mockResolvedValueOnce(taughtPage([], 2, 3))
    .mockResolvedValueOnce(taughtPage([], 3, 3));
  render(<EnrollmentPicker dialogId="both-directions" />);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Lama' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText(/Halaman 1 dari 3/);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Baru' } });
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() => expect(mocks.direct).toHaveBeenLastCalledWith('Kelas Lama', 2));
  await screen.findByText(/Halaman 2 dari 3/);
  fireEvent.click(screen.getByRole('button', { name: 'Sebelumnya' }));
  await waitFor(() => expect(mocks.direct).toHaveBeenLastCalledWith('Kelas Lama', 1));
});

it('adopts the edited draft only on a new Cari, always from page 1', async () => {
  mocks.direct
    .mockResolvedValueOnce(taughtPage([], 1, 12))
    .mockResolvedValueOnce(taughtPage([], 1, 4));
  render(<EnrollmentPicker dialogId="new-search" />);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Lama' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText(/Halaman 1 dari 12/);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Baru' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await waitFor(() => expect(mocks.direct).toHaveBeenLastCalledWith('Kelas Baru', 1));
  await screen.findByText(/Halaman 1 dari 4/);
});

it('allows the Teacher to advance past a session page with no selectable enrollments', async () => {
  mocks.taught
    .mockResolvedValueOnce(taughtPage([], 1, 12))
    .mockResolvedValueOnce(
      taughtPage(
        [{ enrollment_id: ENROLLMENT_B, label: 'Siswa halaman dua · Kelas Dua', class_id: 'class-2' }],
        2,
        12
      )
    );
  const { container } = render(<EnrollmentPicker dialogId="regression" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText(/Tidak ada siswa yang cocok/);
  // The backend counts sessions here, so the total must not wear the
  // student unit.
  expect(screen.getByText(/Halaman 1 dari 12 · 1101 sesi/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() => expect(mocks.taught).toHaveBeenCalledWith('', 2));
  fireEvent.click(await screen.findByRole('button', { name: /Siswa halaman dua/ }));
  const hidden = container.querySelector('input[type="hidden"][name="enrollment_id"]');
  expect((hidden as HTMLInputElement).value).toBe(ENROLLMENT_B);
});

it('keeps pagination across a Teacher page where every attendee read failed', async () => {
  mocks.taught
    .mockResolvedValueOnce(taughtPage([], 1, 12, 3))
    .mockResolvedValueOnce(
      taughtPage(
        [{ enrollment_id: ENROLLMENT_B, label: 'Siswa halaman dua · Kelas Dua', class_id: 'class-2' }],
        2,
        12
      )
    );
  const { container } = render(<EnrollmentPicker dialogId="regression" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  // All three session attendee reads failed: the failure count is reported,
  // the list stays empty, yet traversal to the next session page survives.
  expect(await screen.findByText(/Sebagian data tidak dapat dimuat \(3 sesi terlewat\)/)).toBeTruthy();
  expect(screen.getByText(/Tidak ada siswa yang cocok/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() => expect(mocks.taught).toHaveBeenCalledWith('', 2));
  fireEvent.click(await screen.findByRole('button', { name: /Siswa halaman dua/ }));
  const hidden = container.querySelector('input[type="hidden"][name="enrollment_id"]');
  expect((hidden as HTMLInputElement).value).toBe(ENROLLMENT_B);
});

it('keeps pagination available when a class filter has no matching students', async () => {
  mocks.direct.mockResolvedValue({
    error: null,
    data: {
      items: [{ enrollment_id: 'c0ffee00-1111-4222-8333-444455556666', label: 'Budi', class_id: 'a' }],
      classes: [{ class_id: 'a', name: 'Class A' }, { class_id: 'b', name: 'Class B' }],
      partialFailures: 0,
      pagination: { page: 1, page_size: 100, total_items: 200, total_pages: 2 },
    },
  });
  render(<EnrollmentPicker dialogId="regression" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText('Budi');
  fireEvent.change(screen.getByLabelText('Filter kelas (halaman ini)'), { target: { value: 'b' } });
  expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeTruthy();
  // A filtered-empty page still walks: the next explicit page is fetched.
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  await waitFor(() => expect(mocks.direct).toHaveBeenCalledWith('', 2));
});

it('does not fire a duplicate search while the first is still pending', async () => {
  // The UI serializes requests (Cari disables while loading), so the
  // requestId race guard is defense-in-depth; the observable contract is
  // that a second Cari during loading fires nothing new.
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  mocks.direct.mockReturnValueOnce(first as never);
  render(<EnrollmentPicker dialogId="stale-guard" />);
  fireEvent.change(screen.getByLabelText('Siswa'), { target: { value: 'Kelas Lama' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  // Loading disables the button: the double-click lands on a disabled button.
  fireEvent.click(screen.getByRole('button', { name: 'Mencari…' }));
  resolveFirst(taughtPage([], 1, 12));
  await screen.findByText(/Halaman 1 dari 12/);
  expect(mocks.direct).toHaveBeenCalledTimes(1);
});

it('disables pagination while a page fetch is in flight', async () => {
  let resolvePage!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    resolvePage = resolve;
  });
  mocks.direct
    .mockResolvedValueOnce(taughtPage([], 1, 2))
    .mockReturnValueOnce(pending as never);
  render(<EnrollmentPicker dialogId="loading-guard" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
  await screen.findByText(/Halaman 1 dari 2/);
  fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
  expect(screen.getByRole('button', { name: 'Berikutnya' })).toHaveProperty('disabled', true);
  resolvePage(taughtPage([], 2, 2));
  await screen.findByText(/Halaman 2 dari 2/);
});
