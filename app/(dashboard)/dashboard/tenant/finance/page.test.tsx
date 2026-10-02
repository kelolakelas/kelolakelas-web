import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const { nav, wallet, ledger, accounts, withdrawals } = vi.hoisted(() => ({ nav: vi.fn(), wallet: vi.fn(), ledger: vi.fn(), accounts: vi.fn(), withdrawals: vi.fn() }));
vi.mock('../_queries/membership', () => ({ readTenantNav: nav }));
vi.mock('./_queries/finance', () => ({ readWallet: wallet, readLedger: ledger, readAccounts: accounts, readWithdrawals: withdrawals }));
vi.mock('./_components/FinanceForms', () => ({ AccountForm: () => <div>Tambah rekening</div>, WithdrawalForm: () => <div>Ajukan penarikan</div>, CancelForm: () => <div>Batalkan</div> }));
import FinancePage from './page';
const page = { items: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } };
async function html() { return renderToStaticMarkup(await FinancePage({ searchParams: Promise.resolve({}) })); }
beforeEach(() => {
  vi.clearAllMocks();
  nav.mockResolvedValue({ state: 'ok', membership: { permissions: ['billing:read'] } });
  wallet.mockResolvedValue({ state: 'ok', data: { available_balance: 10000, pending_balance: 0 } });
  ledger.mockResolvedValue({ state: 'ok', data: page });
  accounts.mockResolvedValue({ state: 'ok', data: { items: [{ id: '1', bank_code: 'BCA', account_name: 'A', account_number: '****1234', is_primary: true }] } });
  withdrawals.mockResolvedValue({ state: 'ok', data: page });
});
describe('finance page', () => {
  it('renders read-only wallet and ledger without fetching or offering withdrawal controls', async () => {
    const output = await html();
    expect(output).toContain('Tersedia:');
    expect(output).toContain('Belum ada mutasi');
    expect(output).not.toContain('Ajukan penarikan');
    expect(accounts).not.toHaveBeenCalled();
  });
  it('offers account, withdrawal and cancellation only to members with billing:withdraw', async () => {
    nav.mockResolvedValue({ state: 'ok', membership: { permissions: ['billing:read', 'billing:withdraw'] } });
    withdrawals.mockResolvedValue({ state: 'ok', data: { ...page, items: [{ id: '2', amount: 500, status: 'requested', bank_code: 'BCA', account_number: '****1234', requested_at: '2026-01-01' }] } });
    const output = await html();
    expect(output).toContain('Tambah rekening');
    expect(output).toContain('Ajukan penarikan');
    expect(output).toContain('Batalkan');
  });
  it('shows forbidden and outage distinctly without leaking controls', async () => {
    nav.mockResolvedValue({ state: 'forbidden' });
    wallet.mockResolvedValue({ state: 'forbidden' });
    ledger.mockResolvedValue({ state: 'error' });
    const output = await html();
    expect(output).toContain('tidak memiliki akses');
    expect(output).toContain('tidak dapat dimuat');
    expect(output).not.toContain('Ajukan penarikan');
  });
});
