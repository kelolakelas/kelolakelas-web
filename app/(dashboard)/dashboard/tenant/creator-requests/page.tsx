import { redirect } from 'next/navigation';

export default function TenantCreatorRequestsPage() {
  redirect('/dashboard/tenant/members#owner-account-request');
}
