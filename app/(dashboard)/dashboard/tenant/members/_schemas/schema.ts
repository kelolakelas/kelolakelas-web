import { z } from 'zod';

/**
 * Zod schema matching Permission definitions from Identity API swagger.
 */
export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

/**
 * Zod schema matching Role definitions from Identity API swagger.
 */
export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  is_system_role: z.boolean().optional(),
  tenant_id: z.string().optional(),
  permissions: z.array(permissionSchema).optional(),
});

/**
 * Zod schema matching User/Member structure in tenant context.
 */
export const memberSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().optional(),
  is_parent: z.boolean().optional(),
  role: roleSchema.optional(),
  role_id: z.string().optional(),
  permissions: z.array(permissionSchema).optional(),
  status: z.enum(['active', 'pending', 'inactive']).optional().default('active'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Zod schema matching TenantInvitation definition from Identity API swagger.
 */
export const tenantInvitationSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  email: z.string().email(),
  role_id: z.string(),
  token: z.string().optional(),
  is_used: z.boolean().optional(),
  expires_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Zod schema for inviting a new tenant member form payload.
 */
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
  roleId: z
    .string()
    .trim()
    .min(1, 'Please select a role for the member.'),
  permissionIds: z.array(z.string()).optional().default([]),
});

// TypeScript interfaces derived from Zod schemas & Swagger contract
export type Permission = z.infer<typeof permissionSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Member = z.infer<typeof memberSchema>;
export type TenantInvitation = z.infer<typeof tenantInvitationSchema>;
export type InvitationResponse = TenantInvitation;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
