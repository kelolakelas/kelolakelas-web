'use client';

import { useState, useTransition } from 'react';
import type { Category } from '../_lib/schema';
import { deleteCategory, updateCategory } from '../_actions/classActions';

export function CategoryControl({ category, canUpdate, canDelete }: {
  category: Category; canUpdate: boolean; canDelete: boolean;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || '');
  const [descriptionChanged, setDescriptionChanged] = useState(false);

  function resetDraft() {
    setName(category.name);
    setDescription(category.description || '');
    setDescriptionChanged(false);
  }
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(remove: boolean) {
    startTransition(async () => {
      const form = new FormData();
      form.set('name', name);
      if (descriptionChanged) form.set('description', description);
      const result = await (remove ? deleteCategory(category.id) : updateCategory(category.id, form));
      setMessage(result.errors?.name?.[0] || result.errors?.description?.[0] || result.message);
      setFailed(!result.success);
      if (result.success) {
        setEditing(false);
        setConfirming(false);
      }
    });
  }

  return <div className="space-y-2">
    {editing && <form onSubmit={(event) => { event.preventDefault(); submit(false); }} className="space-y-2">
      <label className="block text-sm" htmlFor={`category-name-${category.id}`}>Category name</label>
      <input id={`category-name-${category.id}`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={pending} className="w-full rounded border p-2" />
      <label className="block text-sm" htmlFor={`category-description-${category.id}`}>Description</label>
      <textarea id={`category-description-${category.id}`} value={description} onChange={(event) => { setDescription(event.target.value); setDescriptionChanged(true); }} disabled={pending} rows={2} aria-describedby={`category-description-help-${category.id}`} className="w-full rounded border p-2" />
      <p id={`category-description-help-${category.id}`} className="text-sm">Leave unchanged to keep the current description. Clearing a description is not supported.</p>
      <button type="submit" disabled={pending} className="rounded border px-3 py-2">{pending ? 'Saving…' : 'Save category'}</button>
      <button type="button" disabled={pending} onClick={() => { setEditing(false); resetDraft(); setMessage(''); }} className="rounded border px-3 py-2">Cancel edit</button>
    </form>}
    {!editing && canUpdate && <button type="button" disabled={pending} onClick={() => { resetDraft(); setEditing(true); setMessage(''); }} className="rounded border px-3 py-2">Edit category</button>}
    {canDelete && !confirming && <button type="button" disabled={pending} onClick={() => { setConfirming(true); setMessage(''); }} className="rounded border px-3 py-2">Delete category</button>}
    {canDelete && confirming && <div className="space-y-2">
      <p>Delete category “{category.name}”? This cannot be undone.</p>
      <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded border px-3 py-2">{pending ? 'Deleting…' : 'Confirm delete'}</button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded border px-3 py-2">Cancel delete</button>
    </div>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </div>;
}
