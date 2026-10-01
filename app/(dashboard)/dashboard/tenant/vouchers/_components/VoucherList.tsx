'use client';

import { useActionState, useState } from 'react';
import { deleteTenantVoucher, updateTenantVoucher } from '../_actions/voucherActions';
import { voucherDiscountLabel, voucherUsageLabel, type TenantVoucher, type VoucherActionResponse } from '../_lib/schema';
import { VoucherForm } from './VoucherForm';

const initialState: VoucherActionResponse = { success: false, message: '' };

function VoucherRow({ voucher }: { voucher: TenantVoucher }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteState, deleteAction, deleting] = useActionState(deleteTenantVoucher, initialState);
  const [toggleState, toggleAction, toggling] = useActionState(updateTenantVoucher, initialState);

  return (
    <li className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{voucher.code}</span>
            <span className={voucher.is_active ? 'text-xs text-emerald-600' : 'text-xs text-gray-500'}>
              {voucher.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {voucherDiscountLabel(voucher)} discount · Used {voucherUsageLabel(voucher)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(!editing)} className="rounded-xl border px-3 py-2 text-xs">{editing ? 'Close editor' : 'Edit'}</button>
          <form action={toggleAction}>
            <input type="hidden" name="voucherId" value={voucher.id} />
            <input type="hidden" name="is_active" value={String(!voucher.is_active)} />
            <button type="submit" disabled={toggling} className="rounded-xl border px-3 py-2 text-xs disabled:opacity-50">
              {voucher.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </form>
          {voucher.current_uses === 0 && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-xl border border-red-300 px-3 py-2 text-xs text-red-700">Delete</button>
          )}
        </div>
      </div>
      {toggleState.message && <p role={toggleState.success ? 'status' : 'alert'} className="text-xs">{toggleState.message}</p>}
      {editing && <VoucherForm voucher={voucher} onCancel={() => setEditing(false)} />}
      {confirmDelete && (
        <div role="group" aria-label={`Delete voucher ${voucher.code}`} className="rounded-xl bg-red-50 p-4 text-sm dark:bg-red-950/30">
          <p>Delete {voucher.code}? This cannot be undone. If the voucher has been used, deactivate it instead.</p>
          <form action={deleteAction} className="mt-3 flex gap-2">
            <input type="hidden" name="voucherId" value={voucher.id} />
            <input type="hidden" name="voucherCode" value={voucher.code} />
            <button type="submit" disabled={deleting} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50">Confirm delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button>
          </form>
          {deleteState.message && <p role={deleteState.success ? 'status' : 'alert'} className="mt-2 text-xs">{deleteState.message}</p>}
        </div>
      )}
    </li>
  );
}

export function VoucherList({ vouchers }: { vouchers: TenantVoucher[] }) {
  if (vouchers.length === 0) {
    return <p className="rounded-2xl border border-dashed p-6 text-sm text-gray-600 dark:text-gray-400">No vouchers yet. Create one to offer a discount.</p>;
  }
  return <ul className="space-y-3">{vouchers.map((voucher) => <VoucherRow key={voucher.id} voucher={voucher} />)}</ul>;
}
