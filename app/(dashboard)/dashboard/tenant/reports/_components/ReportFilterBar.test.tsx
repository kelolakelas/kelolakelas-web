// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import { ReportFilterBar } from './ReportFilterBar';
import { TENANT_REPORTS_PATH } from '../_lib/schema';

const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';

const ENROLLMENT_ID_2 = 'd1ffee11-2222-4333-9444-555566667777';

const OPTIONS_TWO = [
  { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
  { enrollment_id: ENROLLMENT_ID_2, label: 'Siti Aminah · Fisika Dasar' },
];

function controlValue(form: HTMLFormElement, name: string): string {
  const control = form.querySelector(`[name="${name}"]`);

  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    throw new Error(`Expected a filter control named ${name}`);
  }

  return control.value;
}

const FILTERS = {
  search: 'evaluasi',
  enrollmentId: ENROLLMENT_ID,
  dateFrom: '2026-09-01',
  dateTo: '2026-09-30',
};

afterEach(() => cleanup());

beforeEach(() => {
  mocks.push.mockClear();
});

function formOf(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form');

  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Expected the filter bar to render a form');
  }

  return form;
}

/**
 * Regression tests for the KEL-139 fix r3 filter-submit defect.
 *
 * The submit handler used to flip an `isPending` flag that disabled every
 * named control. React flushes that discrete submit event before the browser
 * builds the GET form data set, and disabled controls are not successful
 * controls — so "Terapkan" silently dropped the filters from the URL. The
 * same flag was also set by the "Atur ulang" client navigation, which keeps
 * this component mounted and could leave the form stuck disabled.
 */
describe('ReportFilterBar pending state', () => {
  it('keeps the filter values in the GET data set after submit', () => {
    const { container } = render(<ReportFilterBar {...FILTERS} enrollmentOptions={OPTIONS_TWO} />);
    const form = formOf(container);

    expect(new FormData(form).get('search')).toBe('evaluasi');

    fireEvent.submit(form);

    const data = new FormData(form);
    expect(data.get('search')).toBe('evaluasi');
    expect(data.get('enrollment_id')).toBe(ENROLLMENT_ID);
    expect(data.get('date_from')).toBe('2026-09-01');
    expect(data.get('date_to')).toBe('2026-09-30');
  });

  it('shows the pending state on the submit button only', () => {
    const { container } = render(<ReportFilterBar {...FILTERS} enrollmentOptions={OPTIONS_TWO} />);

    fireEvent.submit(formOf(container));

    const submit = screen.getByRole('button', { name: /Memuat/ });

    expect(submit.getAttribute('type')).toBe('submit');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('navigates on reset without leaving the filter controls disabled', () => {
    const { container } = render(<ReportFilterBar {...FILTERS} enrollmentOptions={OPTIONS_TWO} />);

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang' }));

    expect(mocks.push).toHaveBeenCalledWith(TENANT_REPORTS_PATH);

    const form = formOf(container);
    for (const name of ['search', 'enrollment_id', 'date_from', 'date_to']) {
      const control = form.querySelector(`[name="${name}"]`);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Expected a filter control named ${name}`);
      }

      expect(control.disabled).toBe(false);
    }
  });
});

/**
 * Regression tests for the KEL-139 fix r4 reset defect.
 *
 * "Atur ulang" navigates client-side to the base path, which keeps this
 * component mounted while the URL-derived props go empty. Relaying only on
 * uncontrolled `defaultValue` leaves an edited-but-never-applied value in
 * the DOM, and the next submit re-applies the stale value.
 */
describe('ReportFilterBar reset with URL values', () => {
  it('clears edited-but-unapplied values after reset', () => {
    const { container, rerender } = render(
      <ReportFilterBar {...FILTERS} enrollmentOptions={OPTIONS_TWO} />,
    );
    let form = formOf(container);

    fireEvent.change(form.querySelector('[name="search"]') as HTMLInputElement, {
      target: { value: 'evaluasi edited' },
    });
    fireEvent.change(form.querySelector('[name="enrollment_id"]') as HTMLSelectElement, {
      target: { value: ENROLLMENT_ID_2 },
    });
    fireEvent.change(form.querySelector('[name="date_from"]') as HTMLInputElement, {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(form.querySelector('[name="date_to"]') as HTMLInputElement, {
      target: { value: '2026-10-31' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang' }));
    expect(mocks.push).toHaveBeenCalledWith(TENANT_REPORTS_PATH);

    rerender(
      <ReportFilterBar
        search=""
        enrollmentId=""
        dateFrom=""
        dateTo=""
        enrollmentOptions={OPTIONS_TWO}
      />,
    );
    form = formOf(container);

    expect(controlValue(form, 'search')).toBe('');
    expect(controlValue(form, 'enrollment_id')).toBe('');
    expect(controlValue(form, 'date_from')).toBe('');
    expect(controlValue(form, 'date_to')).toBe('');
  });

  it('shows the new URL search value without a reset', () => {
    const { container, rerender } = render(
      <ReportFilterBar search="" enrollmentId="" dateFrom="" dateTo="" enrollmentOptions={OPTIONS_TWO} />,
    );

    rerender(
      <ReportFilterBar search="baru" enrollmentId="" dateFrom="" dateTo="" enrollmentOptions={OPTIONS_TWO} />,
    );

    expect(controlValue(formOf(container), 'search')).toBe('baru');
  });
});
