export function getSafeRedirect(value: FormDataEntryValue | null, fallback: string): string {
  const redirectTo = typeof value === 'string' ? value : '';
  if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) return fallback;
  if (redirectTo.startsWith('/dashboard/parent') || redirectTo.startsWith('/dashboard/tenant') || redirectTo.startsWith('/classes/')) return redirectTo;
  return fallback;
}