// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approveState: { current: { success: false, message: '' } as Record<string, unknown> },
  rejectState: { current: { success: false, message: '' } as Record<string, unknown> },
  approveScheduleRequest: vi.fn(),
  rejectScheduleRequest: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: (action: unknown) => {
    if (action === mocks.approveScheduleRequest) return [mocks.approveState.current, vi.fn()];
    return [mocks.rejectState.current, vi.fn()];
  },
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../_actions/actions', () => ({
  approveScheduleRequest: mocks.approveScheduleRequest,
  rejectScheduleRequest: mocks.rejectScheduleRequest,
}));

/**
 * Interaction tests for the tenant approve/reject dialogs (KEL-110).
 *
 * The Server Actions are stubbed through `useActionState`, so what is
 * asserted is the dialog contract the acceptance criteria depend on:
 *
 * - the member confirms inside an accessible `<dialog>` (focus is trapped by
 *   the browser, Escape cancels, and focus returns to the trigger),
 * - a refusal keeps the dialog open with the action message where the member
 *   is already looking,
 * - a successful approval stays open on the payment link block with a copy
 *   button and a confirmation, because the action state is the only place
 *   that link exists,
 * - the reject reason stays optional: the textarea ships without `required`
 *   and the control confirms with and without a reason,
 * - dialog ids never collide between the mobile and desktop copies of the
 *   same row.
 */

const { ApproveScheduleRequestDialog, ApprovePaymentLink } = await import('./ApproveScheduleRequestDialog');
const { RejectScheduleRequestDialog } = await import('./RejectScheduleRequestDialog');

const REQUEST_ID = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';
const PAYMENT_URL = 'https://pay.test/checkout/session-1';

beforeEach(() => {
  mocks.approveState.current = { success: false, message: '' };
  mocks.rejectState.current = { success: false, message: '' };
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    },
  });
  // jsdom ships no clipboard; the happy-path approval asserts the block
  // degrades to the manual fallback text instead.
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
  window.localStorage?.clear?.();
});

afterEach(() => cleanup());

describe('ApproveScheduleRequestDialog', () => {
  it('opens the dialog on trigger and returns focus on cancel', () => {
    render(<ApproveScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    const trigger = screen.getByRole('button', { name: 'Setujui' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tidak jadi' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the dialog open with the mapped refusal message', () => {
    mocks.approveState.current = {
      success: false,
      message: 'Permintaan ini sudah tidak dapat diproses karena statusnya sudah berubah.',
    };
    render(<ApproveScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    expect(screen.getByRole('alert').textContent).toContain('statusnya sudah berubah');
    // The refusal renders inside the still-open dialog, not on a new screen.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('maps a 403 refusal to the permission message, never a technical error', () => {
    mocks.approveState.current = {
      success: false,
      message: 'Anda tidak memiliki izin memproses permintaan jadwal ini.',
    };
    render(<ApproveScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki izin');
  });

  it('stays open on the payment link block after a successful approval', () => {
    mocks.approveState.current = {
      success: true,
      message: 'Permintaan jadwal disetujui. Salin tautan pembayaran untuk dibagikan ke parent.',
      paymentUrl: PAYMENT_URL,
      grossAmount: 1500000,
    };
    render(<ApproveScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    expect(screen.getByRole('status').textContent).toContain('disetujui');
    expect(screen.getByDisplayValue(PAYMENT_URL)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salin tautan' })).toBeTruthy();
    // Closing the dialog here would lose the only copy of the link, so the
    // confirm form is gone and only the dismiss control remains.
    expect(screen.queryByRole('button', { name: 'Ya, setujui' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeTruthy();
  });

  it('confirms the approval without a link block when billing has none', () => {
    mocks.approveState.current = {
      success: true,
      message: 'Permintaan jadwal disetujui. Tautan pembayaran belum tersedia dari layanan billing.',
    };
    render(<ApproveScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    expect(screen.getByRole('status').textContent).toContain('belum tersedia');
    expect(screen.queryByRole('button', { name: 'Salin tautan' })).toBeNull();
  });
});

describe('ApprovePaymentLink', () => {
  it('falls back to manual selection when the clipboard is unavailable', async () => {
    render(<ApprovePaymentLink url={PAYMENT_URL} grossAmount={1500000} inputId="approve-payment-link-test" />);

    fireEvent.click(screen.getByRole('button', { name: 'Salin tautan' }));

    expect(await screen.findByText('Penyalinan otomatis gagal. Blokir tautan di atas lalu salin manual.')).toBeTruthy();
    // The readonly input stays so the member can select and copy by hand.
    expect(screen.getByDisplayValue(PAYMENT_URL)).toBeTruthy();
  });

  it('confirms a successful copy without leaving the dialog', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } });

    render(<ApprovePaymentLink url={PAYMENT_URL} grossAmount={null} inputId="approve-payment-link-test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Salin tautan' }));

    expect(await screen.findByText('Tautan pembayaran disalin.')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(PAYMENT_URL);
  });
});

describe('RejectScheduleRequestDialog', () => {
  it('offers an optional reason and confirms the rejection inline', () => {
    mocks.rejectState.current = { success: true, message: 'Permintaan jadwal berhasil ditolak.' };
    render(<RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));

    // The reason is optional: no `required` attribute gates the confirm.
    expect(screen.getByLabelText('Alasan penolakan (opsional)')).toBeTruthy();
    expect(screen.getByLabelText('Alasan penolakan (opsional)').hasAttribute('required')).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('berhasil ditolak');
  });

  it('accepts a rejection without a reason', () => {
    render(<RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));

    const reason = screen.getByLabelText('Alasan penolakan (opsional)') as HTMLTextAreaElement;
    expect(reason.value).toBe('');
    // The confirm control is available with the field untouched.
    expect(screen.getByRole('button', { name: 'Tolak permintaan' })).toBeTruthy();
  });

  it('keeps the dialog open with the mapped refusal message', () => {
    mocks.rejectState.current = {
      success: false,
      message: 'Anda tidak memiliki izin memproses permintaan jadwal ini.',
    };
    render(<RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));

    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki izin');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('never shares dialog ids between the mobile and desktop copies', () => {
    const { container } = render(
      <>
        <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />
        <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="desktop" />
      </>
    );
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`mobile-reject-schedule-request-reason-${REQUEST_ID}`);
    expect(ids).toContain(`desktop-reject-schedule-request-reason-${REQUEST_ID}`);
  });
});

describe('RejectScheduleRequestDialog with a recommendation (KEL-116)', () => {
  function openDialog() {
    render(<RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
  }

  function chooseRecommendation() {
    fireEvent.click(screen.getByLabelText('Tolak dengan rekomendasi jadwal'));
  }

  it('offers a plain reject and a reject-with-recommendation choice', () => {
    openDialog();

    expect(screen.getByLabelText('Tolak', { exact: true })).toBeTruthy();
    expect(screen.getByLabelText('Tolak dengan rekomendasi jadwal')).toBeTruthy();
    // Plain mode is the default: no slot inputs and no slots payload yet.
    expect(screen.queryByText('Slot rekomendasi')).toBeNull();
    expect(document.querySelector('input[name="slots"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tolak permintaan' })).toBeTruthy();
  });

  it('reveals the slot editor and the slots payload in recommendation mode', () => {
    const { container } = render(
      <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
    chooseRecommendation();

    expect(screen.getByText('Slot rekomendasi')).toBeTruthy();
    expect(screen.getByLabelText('Hari')).toBeTruthy();
    expect(screen.getByLabelText('Jam mulai')).toBeTruthy();
    expect(screen.getByLabelText('Jam selesai')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tambah slot' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tolak dengan rekomendasi' })).toBeTruthy();

    const payload = container.querySelector('input[name="slots"]') as HTMLInputElement;
    expect(payload).toBeTruthy();
    expect(JSON.parse(payload.value)).toEqual([{ day_of_week: 1, start_time: '', end_time: '' }]);
  });

  it('blocks a recommendation whose end is not after its start before sending', () => {
    const { container } = render(
      <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
    chooseRecommendation();

    fireEvent.change(screen.getByLabelText('Jam mulai'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Jam selesai'), { target: { value: '17:30' } });
    const form = container.querySelector('dialog form');
    if (!form) throw new Error('reject dialog form not rendered');
    fireEvent.submit(form);

    expect(screen.getByRole('alert').textContent).toContain('setelah jam mulai');
  });

  it('adds and removes recommendation slots', () => {
    openDialog();
    chooseRecommendation();

    fireEvent.click(screen.getByRole('button', { name: 'Tambah slot' }));
    expect(screen.getAllByLabelText('Hari')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus slot ini' })[0]);
    expect(screen.getAllByLabelText('Hari')).toHaveLength(1);
  });

  it('keeps the recommendation slot ids unique across the mobile and desktop copies', () => {
    const { container } = render(
      <>
        <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="mobile" />
        <RejectScheduleRequestDialog requestId={REQUEST_ID} studentName="Budi" idPrefix="desktop" />
      </>
    );
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(`mobile-reject-schedule-request-mode-recommend-${REQUEST_ID}`);
    expect(ids).toContain(`desktop-reject-schedule-request-mode-recommend-${REQUEST_ID}`);
  });
});
