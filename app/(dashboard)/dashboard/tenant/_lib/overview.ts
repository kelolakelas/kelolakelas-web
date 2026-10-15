/** Match overview offers to the existing administration read and invitation gates. */
export function overviewAccess(permissions: readonly string[]) {
  const granted = new Set(permissions);
  const members = granted.has('member:read');
  const roles = granted.has('role:read');
  const settings = granted.has('tenant:read');
  // Invitation links land on the members page, which also requires member:read.
  const invitations = members && granted.has('member:invite');
  return { members, roles, settings, invitations, metricCount: Number(members) + Number(roles) + Number(invitations) };
}
