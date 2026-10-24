// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/parent/students' }));
vi.mock('@/lib/schedule-request-count-actions', () => ({ readPendingScheduleRequestCount: vi.fn() }));
import { readPendingScheduleRequestCount } from '@/lib/schedule-request-count-actions';
import { SCHEDULE_REQUEST_COUNT_REFRESH } from '@/lib/schedule-request-count-events';
import { PendingScheduleRequestProvider, usePendingScheduleRequestCount } from './PendingScheduleRequestProvider';
import { NavigationBadge } from './chat/NavigationBadge';
function Consumer() { return <NavigationBadge count={usePendingScheduleRequestCount()} />; }
const view = (scope: string, enabled = true) => <PendingScheduleRequestProvider scope={scope} enabled={enabled}><Consumer /></PendingScheduleRequestProvider>;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('navigation badge', () => {
  it.each([0, 1, 99, 100, 140, null])('renders boundary %s accessibly', (count) => {
    const { container } = render(<NavigationBadge count={count} />);
    if (count === 0) expect(container.textContent).toBe('');
    else { expect(container.textContent).toBe(count === null ? '…' : count >= 100 ? '99+' : String(count)); expect(container.firstElementChild?.getAttribute('aria-label')).toContain('pesan belum dibaca'); }
  });
});
describe('shared reconciliation', () => {
  it('uses authoritative values for duplicate events and failed reads', async () => {
    vi.mocked(readPendingScheduleRequestCount).mockResolvedValue({ count: 3 });
    render(view('a'));
    await screen.findByLabelText('3 pesan belum dibaca');
    await act(async () => { window.dispatchEvent(new Event(SCHEDULE_REQUEST_COUNT_REFRESH)); window.dispatchEvent(new Event(SCHEDULE_REQUEST_COUNT_REFRESH)); });
    expect(screen.getByLabelText('3 pesan belum dibaca')).toBeTruthy();
    vi.mocked(readPendingScheduleRequestCount).mockResolvedValue({ count: null });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(screen.getByLabelText('Jumlah pesan belum dibaca belum tersedia')).toBeTruthy();
    vi.mocked(readPendingScheduleRequestCount).mockResolvedValue({ count: 0 });
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(screen.queryByText('…')).toBeNull();
  });
  it('discards a delayed prior account response and hides counts without nav permission', async () => {
    let finish!: (value: { count: number }) => void;
    vi.mocked(readPendingScheduleRequestCount).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ count: 2 });
    const { rerender } = render(view('a'));
    rerender(view('b'));
    await screen.findByLabelText('2 pesan belum dibaca');
    await act(async () => finish({ count: 90 }));
    expect(screen.queryByText('90')).toBeNull();
    rerender(view('b', false));
    await waitFor(() => expect(readPendingScheduleRequestCount).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('2')).toBeNull();
  });
  it('reconciles outside inbox every ten seconds without incrementing local counters', async () => {
    vi.useFakeTimers();
    vi.mocked(readPendingScheduleRequestCount).mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 2 });
    render(view('a'));
    await act(async () => {});
    expect(screen.getByText('1')).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByText('2')).toBeTruthy();
  });
});
