// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const config: Record<string, string> = process.env.KEL230_INTEGRATION_CONFIG ? JSON.parse(readFileSync(process.env.KEL230_INTEGRATION_CONFIG, 'utf8')) : {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => key === 'auth_token' ? { value: config.token } : undefined }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ApproveScheduleRequestDialog } from './ApproveScheduleRequestDialog';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe.skipIf(!config.gateway)('parent submission → tenant selection form/action → gateway → PostgreSQL → activation', () => {
  it('materializes only the second proposal, preserves price and activates the same enrollment', async () => {
    vi.stubEnv('GATEWAY_API_URL', config.gateway);
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    const slots = [1, 3, 5].map(day => ({ day_of_week: day, start_time: '10:00:00', end_time: '11:00:00' }));
    const created = await fetch(`${config.gateway}/api/v1/catalog/classes/${config.class}/schedule-requests`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.parentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: config.student, billing_cycle: 'monthly', payment_method: 'VC', slots }),
    });
    expect(created.status).toBe(201);
    const request = (await created.json()).data;
    render(<ApproveScheduleRequestDialog requestId={request.id} studentName="Selection" idPrefix="acceptance" privateSlotLimit={1} slots={slots} />);
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.submit(screen.getByRole('button', { name: 'Ya, setujui' }).closest('form')!);
    await waitFor(() => expect(screen.getByDisplayValue('https://pay.example.test/selected')).toBeTruthy(), { timeout: 20000 });
    const headers = { Authorization: `Bearer ${config.parentToken}` };
    const stored = await (await fetch(`${config.gateway}/api/v1/schedule-requests/${request.id}`, { headers })).json();
    expect(stored.data.slots).toEqual(slots);
    expect(stored.data.approved_slots).toEqual([slots[1]]);
    const replay = await fetch(`${config.gateway}/api/v1/schedule-requests/${request.id}/approve`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}` },
    });
    expect(replay.status).toBe(200);
    const purchase = (await replay.json()).data;
    const enrollmentID = purchase.enrollment.id;
    const readEnrollment = async () => (await (await fetch(`${config.gateway}/api/v1/enrollments/${enrollmentID}`, { headers })).json()).data;
    const pending = await readEnrollment();
    expect(pending.status).toBe('pending');
    expect(pending.private_schedules).toHaveLength(1);
    expect(pending.private_schedules[0]).toMatchObject(slots[1]);
    expect(purchase.payment.gross_amount).toBe(100000);
    const paid = await fetch(`${config.academic}/test/paid/${enrollmentID}`, {
      method: 'POST', headers: { 'X-Internal-Service-Credential': 'isolated-selection-callback' },
    });
    expect(paid.status).toBe(200);
    const active = await readEnrollment();
    expect(active.status).toBe('active');
    expect(active.private_schedules).toEqual(pending.private_schedules);
  }, 60000);
});
