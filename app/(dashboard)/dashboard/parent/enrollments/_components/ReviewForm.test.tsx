// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component test for the parent review form (KEL-160).
 *
 * The acceptance criteria pin the rating control at the interaction level:
 * it must be keyboard-operable and screen-reader legible. The form uses one
 * native radio per star inside a fieldset+legend, so what is asserted is the
 * platform contract, not a custom key handler: real radio inputs with
 * Indonesian labels, keyboard focus and selection, the exact FormData field
 * names the Server Action binds, and client validation that blocks a
 * star-less submit before the action runs.
 *
 * No jest-dom matchers: this repo does not install `@testing-library/jest-dom`,
 * so assertions read `textContent` directly.
 */

const mocks = vi.hoisted(() => ({
  reviewState: { current: { status: 'idle', message: '' } as Record<string, unknown> },
  formAction: vi.fn(),
  saveEnrollmentReview: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [mocks.reviewState.current, mocks.formAction],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../../_actions/review-actions', () => ({
  saveEnrollmentReview: mocks.saveEnrollmentReview,
}));

const { ReviewForm } = await import('./ReviewForm');

const ENROLLMENT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function submittedFormData(): FormData {
  return mocks.formAction.mock.calls[0][0] as FormData;
}

beforeEach(() => {
  mocks.reviewState.current = { status: 'idle', message: '' };
  mocks.formAction.mockClear();
});

afterEach(() => cleanup());

describe('ReviewForm rating control', () => {
  it('renders five native radio inputs in a labelled group with Indonesian labels', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    const group = screen.getByRole('group', { name: 'Rating Anda' });
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    for (const star of [1, 2, 3, 4, 5]) {
      const radio = screen.getByRole('radio', { name: `${star} bintang` }) as HTMLInputElement;
      // Native inputs carry keyboard operation (Tab, arrows, Space) and
      // screen-reader announcements from the platform: no custom key handler
      // reimplements them.
      expect(radio.tagName).toBe('INPUT');
      expect(radio.type).toBe('radio');
      expect(radio.name).toBe('rating');
    }
  });

  it('selects a rating by keyboard focus and submits the exact server-action fields', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    const three = screen.getByRole('radio', { name: '3 bintang' }) as HTMLInputElement;
    three.focus();
    expect(document.activeElement).toBe(three);
    fireEvent.click(three);
    expect(three.checked).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Ceritakan pengalaman/), {
      target: { value: 'Bagus' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Simpan ulasan' }));

    expect(mocks.formAction).toHaveBeenCalledTimes(1);
    expect(submittedFormData().get('rating')).toBe('3');
    expect(submittedFormData().get('comment')).toBe('Bagus');
    expect(submittedFormData().get('enrollment_id')).toBe(ENROLLMENT_ID);
  });

  it('keeps each star keyboard-focusable in tab order', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    for (const star of [1, 2, 3, 4, 5]) {
      const radio = screen.getByRole('radio', { name: `${star} bintang` }) as HTMLInputElement;
      radio.focus();
      expect(document.activeElement).toBe(radio);
    }
  });

  it('blocks submit without a rating and explains what is missing', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simpan ulasan' }));

    expect(screen.getByRole('alert').textContent).toContain('Pilih rating 1–5 bintang.');
    expect(mocks.formAction).not.toHaveBeenCalled();
  });

  it('blocks an over-long comment client-side with the backend limit', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    fireEvent.click(screen.getByRole('radio', { name: '5 bintang' }));
    fireEvent.change(screen.getByPlaceholderText(/Ceritakan pengalaman/), {
      target: { value: 'a'.repeat(2001) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan ulasan' }));

    expect(screen.getByRole('alert').textContent).toContain('maksimal 2000 karakter');
    expect(mocks.formAction).not.toHaveBeenCalled();
  });

  it('shows the live character count and posts through the server action when valid', () => {
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} className="Matematika" />);

    expect(screen.getByText('0/2000 karakter')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '4 bintang' }));
    fireEvent.change(screen.getByPlaceholderText(/Ceritakan pengalaman/), {
      target: { value: 'Bagus' },
    });
    expect(screen.getByText('5/2000 karakter')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simpan ulasan' }));

    expect(mocks.formAction).toHaveBeenCalledTimes(1);
    expect(submittedFormData().get('rating')).toBe('4');
  });

  it('announces a backend refusal where the parent is already looking', () => {
    mocks.reviewState.current = { status: 'error', message: 'Enrollment ini belum memenuhi syarat untuk diulas.' };
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    expect(screen.getByRole('alert').textContent).toContain('belum memenuhi syarat');
  });

  it('announces a successful save as a status, not an alert', () => {
    mocks.reviewState.current = { status: 'success', message: 'Ulasan tersimpan.' };
    render(<ReviewForm enrollmentId={ENROLLMENT_ID} />);

    expect(screen.getByRole('status').textContent).toContain('Ulasan tersimpan.');
  });
});
