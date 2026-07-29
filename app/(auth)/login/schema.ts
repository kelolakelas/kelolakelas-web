import { z } from 'zod';

/**
 * Zod schema for login form validation
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .min(6, { message: 'Password must be at least 6 characters long.' }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
