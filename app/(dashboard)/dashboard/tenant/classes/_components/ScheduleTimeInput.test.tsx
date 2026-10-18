// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ScheduleTimeInput } from './ScheduleTimeInput';

afterEach(cleanup);
function setup(initial = '09:00') {
  function Form() {
    const [value, setValue] = useState(initial);
    return (
      <form>
        <label htmlFor="time">Start time</label>
        <ScheduleTimeInput
          id="time"
          required
          value={value}
          onValueChange={setValue}
        />
        <button>Next</button>
        <output>{value}</output>
      </form>
    );
  }
  render(<Form />);
  const input = screen.getByLabelText('Start time') as HTMLInputElement;
  input.focus();
  return input;
}
function insert(
  input: HTMLInputElement,
  data: string,
  inputType = 'insertText',
) {
  const start = input.selectionStart!;
  const end = input.selectionEnd!;
  const value = input.value.slice(0, start) + data + input.value.slice(end);
  fireEvent.input(input, {
    target: {
      value,
      selectionStart: start + data.length,
      selectionEnd: start + data.length,
    },
    data,
    inputType,
  });
}

describe('schedule wall-clock entry', () => {
  it.each(['00', '12', '23'])(
    'advances valid completed hour %s to minutes and preserves seconds',
    (hour) => {
      const input = setup('09:30:45');
      insert(input, hour[0]);
      insert(input, hour[1]);
      expect([input.selectionStart, input.selectionEnd]).toEqual([3, 5]);
      insert(input, '5');
      insert(input, '9');
      expect(input.value).toBe(`${hour}:59:45`);
      expect(input.validity.valid).toBe(true);
      input.setSelectionRange(0, 2);
      insert(input, '0');
      insert(input, '8');
      expect(input.value).toBe('08:59:45');
    },
  );
  it('builds a time from empty with a numeric keyboard', () => {
    const input = setup('');
    for (const digit of '1234') insert(input, digit);
    expect(input.value).toBe('12:34');
    expect(input.validity.valid).toBe(true);
  });
  it('leaves paste and deletion caret alone; pads single-digit segments on blur', () => {
    const input = setup();
    input.select();
    insert(input, '7:5', 'insertFromPaste');
    expect(input.selectionStart).toBe(3);
    fireEvent.blur(input);
    expect(input.value).toBe('07:05');
    input.focus();
    input.setSelectionRange(0, 2);
    insert(input, '', 'deleteContentBackward');
    expect(input.value).toBe(':05');
    expect(input.selectionStart).toBe(0);
    expect(input.validity.valid).toBe(false);
  });
  it.each(['24:60', '25:00', '23:60', '12:30:60', 'noon', ''])(
    'rejects invalid time %s without silently repairing it',
    (value) => {
      const input = setup();
      input.select();
      insert(input, value, 'insertFromPaste');
      fireEvent.blur(input);
      expect(input.value).toBe(value);
      expect(input.validity.valid).toBe(false);
    },
  );
  it('does not advance invalid hours or intercept navigation keys', () => {
    const input = setup();
    insert(input, '2');
    insert(input, '4');
    expect(input.selectionStart).toBe(2);
    expect(input.value).toBe('24:00');
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Backspace' })).toBe(true);
  });
});
