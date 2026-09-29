'use server';

import { getTenantReports, type TenantReportsResult } from '../_queries/queries';

/**
 * Report search/pagination reader for the tenant chat picker (KEL-124).
 *
 * Thin wrapper over `getTenantReports` so the client picker can walk pages
 * and search without a full route navigation. The permission contract is
 * unchanged: a member without `report:read` gets `forbidden`, and the
 * chat-service enforces the same permission when the conversation starts.
 */
export async function searchTenantReports(search: string, page: number): Promise<TenantReportsResult> {
  return getTenantReports({ search, page });
}
