import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { readCreatorRequests, type CreatorRequest } from '@/lib/creator-requests';
import { OwnerAccountRequests } from './OwnerAccountRequests';

vi.mock('@/lib/creator-requests', () => ({ readCreatorRequests: vi.fn() }));
vi.mock('../../creator-requests/RequestForm', () => ({ RequestForm: () => <form aria-label="request-form" /> }));

beforeEach(() => vi.clearAllMocks());

it('shows the form and pending/approved/rejected status only after an authorized read', async () => {
  vi.mocked(readCreatorRequests).mockResolvedValue({ status: 200, message: '', data: ['pending', 'approved', 'rejected'].map((status, i) => ({ id: String(i), target_email: `${status}@example.test`, status, reason: '<script>reason</script>', rejection_reason: status === 'rejected' ? 'Not allowed' : undefined } as CreatorRequest)) });
  const html = renderToStaticMarkup(await OwnerAccountRequests());
  expect(readCreatorRequests).toHaveBeenCalledWith(false);
  expect(html).toContain('id="owner-account-request"');
  expect(html).toContain('Owner Account Request');
  expect(html).toContain('request-form');
  for (const status of ['pending', 'approved', 'rejected']) expect(html).toContain(`${status}@example.test`);
  expect(html).toContain('Rejection reason: Not allowed');
  expect(html).toContain('&lt;script&gt;');
});

it.each([401, 403])('hides request controls and status for %s', async status => {
  vi.mocked(readCreatorRequests).mockResolvedValue({ status, message: 'Access denied.', data: [] });
  expect(await OwnerAccountRequests()).toBeNull();
});

it('shows a readable failure without a submit form when the read is unavailable', async () => {
  vi.mocked(readCreatorRequests).mockResolvedValue({ status: 503, message: 'Could not load Owner Account Requests. Try again.', data: [] });
  const html = renderToStaticMarkup(await OwnerAccountRequests());
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('request-form');
});

it('handles an empty request list', async () => {
  vi.mocked(readCreatorRequests).mockResolvedValue({ status: 200, message: '', data: [] });
  expect(renderToStaticMarkup(await OwnerAccountRequests())).toContain('No requests yet.');
});
