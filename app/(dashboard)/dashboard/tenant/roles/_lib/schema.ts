import { z } from 'zod';

/**
 * Standardized Action Response Interface for Server Actions.
 */
export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: unknown;
}

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
  permissions: z.array(permissionSchema).optional().default([]),
});

/**
 * Zod schema for creating a new tenant custom role.
 */
export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Role name is required.')
    .max(50, 'Role name must not exceed 50 characters.'),
  description: z
    .string()
    .trim()
    .max(200, 'Description must not exceed 200 characters.')
    .optional()
    .default(''),
  permissionIds: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one permission must be selected for the role.'),
});

/**
 * Zod schema for updating a custom role.
 */
export const updateRoleSchema = z.object({
  roleId: z.string().trim().min(1, 'Role ID is required.'),
  name: z
    .string()
    .trim()
    .min(1, 'Role name is required.')
    .max(50, 'Role name must not exceed 50 characters.'),
  description: z
    .string()
    .trim()
    .max(200, 'Description must not exceed 200 characters.')
    .optional()
    .default(''),
  permissionIds: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one permission must be selected for the role.'),
});

// Derived TypeScript types
export type Permission = z.infer<typeof permissionSchema>;
export type Role = z.infer<typeof roleSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
