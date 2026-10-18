'use client';

import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** A wall-clock string, never a Date: shared by manual, generated and saved slots. */
export function ScheduleTimeInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const advance = useRef(false);
  useLayoutEffect(() => {
    if (advance.current && input.current === document.activeElement) {
      input.current?.setSelectionRange(3, 5);
    }
    advance.current = false;
  }, [value]);

  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="numeric"
      placeholder="HH:mm"
      pattern="([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?"
      title="Use 24-hour time: HH:mm (or HH:mm:ss)"
      value={value}
      onFocus={(event) => {
        // Keyboard entry starts on hours; a pointer can still select any part.
        event.currentTarget.setSelectionRange(
          0,
          value.indexOf(':') > 0 ? value.indexOf(':') : value.length,
        );
        onFocus?.(event);
      }}
      onChange={(event) => {
        let next = event.currentTarget.value;
        const native = event.nativeEvent as InputEvent;
        if (
          native.inputType === 'insertText' &&
          /^(?:[01]\d|2[0-3])$/.test(next)
        )
          next += ':';
        advance.current =
          native.inputType === 'insertText' &&
          /^\d$/.test(native.data ?? '') &&
          event.currentTarget.selectionStart === 2 &&
          /^(?:[01]\d|2[0-3]):/.test(next);
        onValueChange(next);
      }}
      onBlur={(event) => {
        // Accept single-digit segments without changing seconds or timezone.
        const match = /^(\d{1,2}):(\d{1,2})(:\d{2})?$/.exec(value);
        if (match && Number(match[1]) < 24 && Number(match[2]) < 60) {
          onValueChange(
            `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}${match[3] ?? ''}`,
          );
        }
        onBlur?.(event);
      }}
    />
  );
}
