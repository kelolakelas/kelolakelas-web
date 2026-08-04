'use server';

import { apiRequest } from '@/lib/api/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getInvitationErrorMessage } from '../_lib/flow';

const registerSchema = z.object({ token: z.string().min(1), first_name: z.string().trim().min(1), last_name: z.string().trim().min(1), password: z.string().min(6) });
export interface InvitationActionResponse { success: boolean; message: string; }
export async function registerInvitation(_previous: InvitationActionResponse, formData: FormData): Promise<InvitationActionResponse> { const validation = registerSchema.safeParse(Object.fromEntries(formData)); if (!validation.success) return { success: false, message: 'Nama dan password wajib valid.' }; try { await apiRequest('/api/v1/invitations/register', { method: 'POST', body: JSON.stringify(validation.data) }); revalidatePath('/invitations/register'); return { success: true, message: 'Registrasi berhasil. Silakan login.' }; } catch (error) { return { success: false, message: getInvitationErrorMessage(error, 'register') }; } }