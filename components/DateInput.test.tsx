// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DateInput } from './DateInput';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const input = (label = 'Tanggal') => screen.getByLabelText(label) as HTMLInputElement;
const payload = () => new FormData(screen.getByTestId('form') as HTMLFormElement).get('date');
function Form(props: Partial<React.ComponentProps<typeof DateInput>>) {
  return <form data-testid="form"><DateInput label="Tanggal" name="date" {...props} /><button>Simpan</button></form>;
}
describe('segmented date entry', () => {
  it('advances valid full day/month, preserves partial drafts and submits canonical ISO', () => {
    render(<Form required />);
    const day = input(), month = input('Tanggal bulan'), year = input('Tanggal tahun');
    fireEvent.change(day, { target: { value: '0' } });
    expect(day.value).toBe('0'); expect(payload()).toBe(''); expect(day.checkValidity()).toBe(false);
    fireEvent.change(day, { target: { value: '03' } }); expect(document.activeElement).toBe(month);
    fireEvent.change(month, { target: { value: '02' } }); expect(document.activeElement).toBe(year);
    fireEvent.change(year, { target: { value: '2018' } });
    expect(payload()).toBe('2018-02-03'); expect(day.checkValidity()).toBe(true);
    fireEvent.change(month, { target: { value: '13' } });
    expect(payload()).toBe(''); expect(day.checkValidity()).toBe(false);
  });
  it('preserves controlled partial input and accepts an external edit reset', () => {
    function Controlled() {
      const [value, setValue] = useState('2018-02-03');
      return <><DateInput label="Tanggal" value={value} onValueChange={setValue} /><button onClick={() => setValue('2020-03-04')}>Ganti</button></>;
    }
    render(<Controlled />);
    fireEvent.change(input(), { target: { value: '1' } }); expect(input().value).toBe('1');
    fireEvent.change(input('Tanggal bulan'), { target: { value: '' } });
    expect(input().value).toBe('1'); expect(input('Tanggal tahun').value).toBe('2018');
    fireEvent.click(screen.getByText('Ganti')); expect(input().value).toBe('04');
  });
  it('supports paste, correction, backspace between segments and explicit clear', () => {
    render(<Form />);
    fireEvent.paste(input(), { clipboardData: { getData: () => '29/02/2024' } });
    expect(payload()).toBe('2024-02-29'); expect(document.activeElement).toBe(input('Tanggal tahun'));
    fireEvent.change(input('Tanggal tahun'), { target: { value: '' } });
    fireEvent.keyDown(input('Tanggal tahun'), { key: 'Backspace' });
    expect(document.activeElement).toBe(input('Tanggal bulan'));
    fireEvent.click(screen.getByLabelText('Kosongkan Tanggal'));
    expect(payload()).toBe(''); expect(input().checkValidity()).toBe(true); expect(document.activeElement).toBe(input());
  });
  it('shows the attempted impossible pasted date instead of silently retaining an old date', () => {
    render(<Form defaultValue="2024-02-29" />);
    fireEvent.paste(input(), { clipboardData: { getData: () => '29/02/2026' } });
    expect(payload()).toBe(''); expect(input('Tanggal tahun').value).toBe('2026');
    expect(input().checkValidity()).toBe(false); expect(screen.getByRole('alert').textContent).toContain('valid');
  });
  it('rejects leap errors and out-of-range dates while allowing exact endpoints', () => {
    render(<Form min="2024-02-28" max="2024-03-01" />);
    fireEvent.change(input(), { target: { value: '2026-02-29' } });
    expect(payload()).toBe('');
    fireEvent.change(input(), { target: { value: '2024-02-27' } });
    expect(input().checkValidity()).toBe(false); expect(screen.getByRole('alert').textContent).toContain('paling awal');
    fireEvent.change(input(), { target: { value: '2024-03-02' } });
    expect(input().checkValidity()).toBe(false); expect(screen.getByRole('alert').textContent).toContain('paling akhir');
    fireEvent.change(input(), { target: { value: '2024-03-01' } }); expect(input().checkValidity()).toBe(true);
  });
  it('resets uncontrolled form state and omits disabled named values', () => {
    const { rerender } = render(<Form defaultValue="2018-02-03" />);
    fireEvent.click(screen.getByLabelText('Kosongkan Tanggal'));
    act(() => (screen.getByTestId('form') as HTMLFormElement).reset());
    expect(payload()).toBe('2018-02-03');
    rerender(<Form disabled />);
    expect(input().disabled).toBe(true); expect(payload()).toBeNull();
  });
  it('prefills a new edit target after a successful create reset without remounting', () => {
    const { rerender } = render(<Form />);
    fireEvent.change(input(), { target: { value: '2018-02-03' } });
    act(() => (screen.getByTestId('form') as HTMLFormElement).reset());
    rerender(<Form defaultValue="2018-02-03" />);
    expect(payload()).toBe('2018-02-03'); expect(input().value).toBe('03');
  });
});
describe('calendar picker keyboard and direct year selection', () => {
  it('chooses a distant year/month without stepping through years, returns focus and preserves ISO', () => {
    render(<Form defaultValue="2026-10-25" />);
    const trigger = screen.getByLabelText('Buka kalender Tanggal');
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: '25 Oktober 2026' }));
    fireEvent.change(screen.getByLabelText('Tahun kalender Tanggal'), { target: { value: '1980' } });
    fireEvent.change(screen.getByLabelText('Bulan kalender Tanggal'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('gridcell', { name: '29 Februari 1980' }));
    expect(payload()).toBe('1980-02-29'); expect(document.activeElement).toBe(trigger); expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger); fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('supports arrow navigation across months without closing and prevents out-of-range selection', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { queueMicrotask(() => callback(0)); return 0; });
    render(<Form defaultValue="2024-02-29" max="2024-02-29" />);
    fireEvent.keyDown(input(), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(screen.getByRole('gridcell', { name: '29 Februari 2024' }), { key: 'ArrowRight' });
    await act(async () => {});
    expect(screen.getByRole('dialog')).toBeTruthy();
    const tomorrow = screen.getByRole('gridcell', { name: '1 Maret 2024' });
    expect(tomorrow.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(tomorrow); expect(payload()).toBe('2024-02-29');
  });
});
