// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../_actions/actions', () => ({ createStudent: vi.fn(), updateStudent: vi.fn() }));
import { StudentForm } from './StudentForm';
import type { Student } from '@/lib/students';
afterEach(cleanup);
it('rejects future DOB in create/edit while retaining the named calendar payload', () => {
  for (const student of [undefined, { id: 's', first_name: 'Alya', date_of_birth: '2018-02-03T00:00:00Z' } as Student]) {
    const { container, unmount } = render(<StudentForm student={student} onCancel={() => {}} />);
    const day = screen.getByLabelText('Tanggal lahir') as HTMLInputElement;
    fireEvent.change(day, { target: { value: '2999-01-01' } });
    expect(day.checkValidity()).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('paling akhir');
    fireEvent.change(day, { target: { value: '2018-02-03' } });
    expect(day.checkValidity()).toBe(true);
    expect(new FormData(container.querySelector('form')!).get('date_of_birth')).toBe('2018-02-03');
    unmount();
  }
});
