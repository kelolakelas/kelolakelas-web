'use client';

import { DateInput } from '@/components/DateInput';

import { useId, useState, useSyncExternalStore } from 'react';
import { voucherDateTimePayload, voucherLocalDateTime } from '../_lib/datetime';

interface Props {
  name: 'valid_from' | 'valid_until';
  label: string;
  initialValue?: string | null;
  error?: string;
  controlClass: string;
}

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Delay local-calendar parsing until hydration so a server timezone cannot change the displayed day. */
export function VoucherDateTimeField(props: Props) {
  const browser = useSyncExternalStore(
    subscribe,
    browserSnapshot,
    serverSnapshot,
  );
  return browser ? (
    <LocalDateTimeField {...props} />
  ) : (
    <p className="text-xs">Loading {props.label.toLowerCase()}…</p>
  );
}

function LocalDateTimeField({
  name,
  label,
  initialValue,
  error,
  controlClass,
}: Props) {
  const id = useId();
  const [parts, setParts] = useState(() => voucherLocalDateTime(initialValue));
  const [changed, setChanged] = useState(false);
  const description = `${id}-help${error ? ` ${id}-error` : ''}`;
  const payload = changed
    ? voucherDateTimePayload(parts.date, parts.time)
    : (initialValue ?? '');
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </legend>
      <input type="hidden" name={name} value={payload} />
      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={`${id}-date`}
            className="block text-xs text-gray-600 dark:text-gray-400"
          >
            Date
          </label>
          <DateInput label={`${label} date`}
            id={`${id}-date`}
            value={parts.date}
            aria-label={`${label} date`}
            aria-invalid={Boolean(error)}
            aria-describedby={description}
            onValueChange={(date) => {
              setParts({
                date,
                time:
                  parts.time ||
                  (name === 'valid_from' ? '00:00:00' : '23:59:59'),
              });
              setChanged(true);
            }}
            className={`min-w-0 max-w-full ${controlClass}`}
          />
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${id}-time`}
            className="block text-xs text-gray-600 dark:text-gray-400"
          >
            Time
          </label>
          <input
            id={`${id}-time`}
            type="time"
            step="1"
            value={parts.time}
            required={Boolean(parts.date)}
            disabled={!parts.date}
            aria-label={`${label} time`}
            aria-invalid={Boolean(error)}
            aria-describedby={description}
            onChange={(event) => {
              setParts({ ...parts, time: event.target.value });
              setChanged(true);
            }}
            className={`min-w-0 max-w-full ${controlClass}`}
          />
        </div>
      </div>
      <p
        id={`${id}-help`}
        className="text-[11px] text-gray-500 dark:text-gray-400"
      >
        Your local time, including seconds.{' '}
        {name === 'valid_from'
          ? 'New dates start at 00:00:00.'
          : 'New dates end at 23:59:59.'}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-red-500">
          {error}
        </p>
      )}
    </fieldset>
  );
}
