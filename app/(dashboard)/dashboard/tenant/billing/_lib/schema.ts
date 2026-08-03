import { z } from 'zod';

export const billingSchema = z.object({
  tenant_id: z.string().trim().min(1), class_id: z.string().trim().min(1), enrollment_id: z.string().trim().min(1), student_id: z.string().trim().min(1), parent_id: z.string().trim().min(1),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly']), subtotal_amount: z.coerce.number().int().gt(0), discount_amount: z.coerce.number().int().min(0), platform_fee: z.coerce.number().int().min(0), payment_gateway_fee: z.coerce.number().int().min(0), sender_name: z.string().trim().optional(), sender_email: z.string().email().optional().or(z.literal('')), sender_phone: z.string().trim().optional(), title: z.string().trim().optional(), voucher_id: z.string().trim().optional(),
});
export type BillingInput = z.infer<typeof billingSchema>;
export interface BillingTransactionResponse { checkout_session_url: string; gross_amount: number; payment_intent_id: string; status: string; transaction_id: string; }
