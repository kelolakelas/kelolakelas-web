'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateTenantSettings } from '../_actions/actions';
import type { SettingsActionResponse, TenantSettings } from '../_lib/schema';

const initialState: SettingsActionResponse = { success: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? 'Menyimpan...' : 'Simpan perubahan'}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: TenantSettings }) {
  const [state, formAction] = useActionState(updateTenantSettings, initialState);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (state.success) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.success]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [isDirty]);

  return (
    <form action={formAction} className="space-y-5" onChange={() => setIsDirty(true)}>
      {state.message && (
        <div role="status" className={`rounded-lg border p-3 text-sm ${state.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {state.message}
        </div>
      )}
      {(['name', 'address', 'phone'] as const).map((field) => (
        <label key={field} className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {field === 'name' ? 'Nama organisasi' : field === 'address' ? 'Alamat' : 'Nomor telepon'}
          </span>
          {field === 'address' ? (
            <textarea name={field} defaultValue={settings[field] || ''} rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900" />
          ) : (
            <input name={field} type={field === 'phone' ? 'tel' : 'text'} defaultValue={settings[field] || ''} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900" />
          )}
          {state.errors?.[field] && <span className="text-xs text-red-600">{state.errors[field][0]}</span>}
        </label>
      ))}
      <div className="flex justify-end"><SubmitButton /></div>
    </form>
  );
}