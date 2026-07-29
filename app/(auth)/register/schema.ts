import { z } from 'zod';

/**
 * Zod schema for Parent Registration based on Identity Service API contract (/api/v1/auth/register)
 */
export const parentRegisterSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, { message: 'First name is required.' }),
  last_name: z
    .string()
    .trim()
    .min(1, { message: 'Last name is required.' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .min(6, { message: 'Password must be at least 6 characters long.' }),
  phone: z
    .string()
    .trim()
    .optional(),
  is_parent: z
    .boolean()
    .default(true),
});

export type ParentRegisterFormValues = z.infer<typeof parentRegisterSchema>;

/**
 * Zod schema for Tenant Registration based on Identity Service API contract (/api/v1/tenants/register)
 */
export const tenantRegisterSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, { message: 'First name is required.' }),
  last_name: z
    .string()
    .trim()
    .min(1, { message: 'Last name is required.' }),
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .min(6, { message: 'Password must be at least 6 characters long.' }),
  phone: z
    .string()
    .trim()
    .optional(),
  tenant_name: z
    .string()
    .trim()
    .min(1, { message: 'Organization name is required.' }),
  tenant_address: z
    .string()
    .trim()
    .optional(),
  tenant_phone: z
    .string()
    .trim()
    .optional(),
});

export type TenantRegisterFormValues = z.infer<typeof tenantRegisterSchema>;
