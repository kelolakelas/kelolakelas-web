export interface TenantChoice {
  tenant_id: string;
  tenant_name: string;
  member_id: string;
  role_id: string;
  role_name: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isTenantChoice(value: unknown): value is TenantChoice {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['tenant_id', 'member_id', 'role_id'].every(key => typeof item[key] === 'string' && UUID.test(item[key] as string)) &&
    typeof item.tenant_name === 'string' && typeof item.role_name === 'string';
}
