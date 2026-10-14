import type { ReactNode } from 'react';
import { readTenantNav } from '../_queries/membership';

export async function AdminReadGate({ permission, children }: { permission: string; children: ReactNode }) {
  const read = await readTenantNav();
  if (read.state !== 'ok' || !read.membership.permissions.includes(permission)) {
    return <section role="alert"><h2>Akses ditolak</h2><p>Anda tidak memiliki akses ke administrasi tenant ini.</p></section>;
  }
  return children;
}
