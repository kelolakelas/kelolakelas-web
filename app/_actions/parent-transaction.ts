'use server';

import { getParentTransaction } from '@/app/(dashboard)/dashboard/parent/_queries/queries';

export async function refreshParentTransaction(id: string) {
  return getParentTransaction(id);
}