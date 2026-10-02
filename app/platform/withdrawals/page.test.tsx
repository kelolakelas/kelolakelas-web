import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { read, readHistory, redirect } = vi.hoisted(() => ({ read: vi.fn(), readHistory: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/platform-withdrawals', () => ({ readPlatformWithdrawals: read, readPlatformWithdrawalHistory: readHistory }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('./DecisionForm', () => ({ DecisionForm: () => <button>Review withdrawal</button> }));
import Page from './page';
const pagination = { page: 1, total_pages: 2, total_items: 21 };
const item = { id: 'abc', tenant_id: 'tenant-1', amount: 100000, admin_fee: 1000, net_amount: 99000, status: 'requested', bank_code: 'BCA', account_number: '12345678', account_name: 'Account holder', requested_at: '2026-10-02' };
const paid = { id: 'paid-1', tenant_id: 'tenant-9', amount: 200000, admin_fee: 2000, net_amount: 198000, status: 'paid', bank_code: 'BCA', account_number: '99998888', account_name: 'Paid holder', requested_at: '2026-10-01', decided_by: 'admin-1', decided_at: '2026-10-02T10:00:00Z', transfer_reference: 'REF-42' };
const html = async (page?: string, history_page?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page, history_page }) }));
describe('platform withdrawal page', () => {
  beforeEach(() => { vi.clearAllMocks(); read.mockResolvedValue({ status: 200, data: { items: [], pagination: { page: 1, total_pages: 0, total_items: 0 } }, message: '' }); readHistory.mockResolvedValue({ status: 200, data: { items: [], pagination: { page: 1, total_pages: 0, total_items: 0 } }, message: '' }); });
  it('renders empty queue without decision controls', async () => {
    expect(await html()).toContain('No pending withdrawals.');
    expect(await html()).not.toContain('Review withdrawal</button>');
  });
  it('shows the frozen full payout destination, amount, and pagination', async () => {
    read.mockResolvedValue({ status: 200, data: { items: [item], pagination }, message: '' });
    const output = await html('1');
    expect(output).toContain('12345678');
    expect(output).toContain('tenant-1');
    expect(output).toContain('Account holder');
    expect(output).toContain('Review withdrawal');
    expect(output).toContain('page=2');
    expect(output).toContain('2026-10-02');
  });
  it('redirects expired sessions and never renders protected data on upstream failure', async () => {
    read.mockResolvedValue({ status: 401, data: null, message: 'Session expired.' });
    await html(); expect(redirect).toHaveBeenCalledWith('/platform/login');
    read.mockResolvedValue({ status: 403, data: null, message: 'Access denied.' });
    const output = await html();
    expect(output).toContain('Access denied.');
    expect(output).not.toContain('Review withdrawal</button>');
  });
  it('renders paid history with full account number, decider, and reference', async () => {
    readHistory.mockResolvedValue({ status: 200, data: { items: [paid], pagination: { page: 1, total_pages: 3, total_items: 25 } }, message: '' });
    const output = await html();
    expect(output).toContain('Recent decisions');
    expect(output).toContain('99998888');
    expect(output).toContain('tenant-9');
    expect(output).toContain('admin-1');
    expect(output).toContain('REF-42');
    expect(output).toContain('Paid');
    expect(output).toContain('history_page=2');
  });
  it('renders a clear empty history state', async () => {
    const output = await html();
    expect(output).toContain('Recent decisions');
    expect(output).toContain('No decisions recorded yet.');
  });
  it('keeps the queue and forms visible when history fails to load', async () => {
    read.mockResolvedValue({ status: 200, data: { items: [item], pagination }, message: '' });
    readHistory.mockResolvedValue({ status: 503, data: null, message: 'Could not load decision history. Try again.' });
    const output = await html();
    expect(output).toContain('Review withdrawal');
    expect(output).toContain('12345678');
    expect(output).toContain('Recent decisions');
    expect(output).toContain('Could not load decision history. Try again.');
    expect(output).not.toContain('99998888');
  });
});
