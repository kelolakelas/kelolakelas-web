// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { value: 'session-token' };
      if (name === 'tenant_id') return { value: 'tenant-from-cookie' };
      return undefined;
    },
  })),
}));

import { ClassStatusBadges, ClassPublicationButton } from './ClassPublicationControl';
import { updateClassPublication } from '../_actions/classActions';

const classId = '9b9ee145-f561-4acb-b231-6d22d076369c';
const previousState = { success: false, message: '' };
let fetchMock: ReturnType<typeof vi.fn>;

function publicationResponse(isPublished: boolean, status = 200) {
  return new Response(JSON.stringify({
    status: status < 400 ? 'success' : 'error',
    data: { id: classId, is_published: isPublished, enrollment_status: 'open' },
  }), { status });
}

function publicationForm(isPublished: string) {
  const form = new FormData();
  form.set('class_id', classId);
  form.set('is_published', isPublished);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('publishes without success copy and retains authenticated payload, data and revalidation', async () => {
  fetchMock.mockResolvedValue(publicationResponse(true));
  const result = await updateClassPublication(previousState, publicationForm('true'));

  expect(result).toEqual({
    success: true,
    message: '',
    data: { id: classId, is_published: true, enrollment_status: 'open' },
  });
  expect(fetchMock).toHaveBeenCalledWith(
    `http://gateway.test/api/v1/classes/${classId}/published`,
    expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({
        Authorization: 'Bearer session-token',
        'X-Tenant-ID': 'tenant-from-cookie',
      }),
      body: JSON.stringify({ is_published: true }),
      cache: 'no-store',
    }),
  );
  expect(revalidate).toHaveBeenCalledWith('/dashboard/tenant/classes');
});

it('clears a prior error after publish and follows the refreshed server record without success copy', async () => {
  fetchMock.mockResolvedValueOnce(publicationResponse(false, 403));
  const view = render(<ClassPublicationButton classId={classId} record={{ is_published: false }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  expect((await screen.findByRole('alert')).textContent).toContain('class:update');
  expect(revalidate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();

  fetchMock.mockResolvedValueOnce(publicationResponse(true));
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await waitFor(() => expect(revalidate).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText('Class published. It is now visible in /kelas.')).toBeNull();

  view.rerender(<>
    <ClassPublicationButton classId={classId} record={{ is_published: true, enrollment_status: 'open' }} />
    <ClassStatusBadges record={{ is_published: true, enrollment_status: 'open' }} />
  </>);
  expect(screen.getByRole('button', { name: 'Unpublish' })).toBeTruthy();
  expect(screen.getByText('Published')).toBeTruthy();
  expect(screen.getByText('Open for enrollment')).toBeTruthy();
});

it('retains unpublish feedback and returns the control to Publish after server refresh', async () => {
  fetchMock.mockResolvedValue(publicationResponse(false));
  const view = render(<ClassPublicationButton classId={classId} record={{ is_published: true }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

  expect((await screen.findByRole('status')).textContent).toBe('Class unpublished. It is no longer visible in /kelas.');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ is_published: false });
  expect(revalidate).toHaveBeenCalledWith('/dashboard/tenant/classes');
  view.rerender(<ClassPublicationButton classId={classId} record={{ is_published: false }} />);
  expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
});

it.each([401, 403, 404, 503])('keeps actionable publication error %s visible without revalidation', async (status) => {
  fetchMock.mockResolvedValue(publicationResponse(false, status));
  render(<ClassPublicationButton classId={classId} record={{ is_published: false }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

  expect((await screen.findByRole('alert')).textContent).not.toBe('');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  expect(revalidate).not.toHaveBeenCalled();
});

it('keeps a network failure visible instead of claiming publication success', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock.mockRejectedValue(new Error('offline'));
  render(<ClassPublicationButton classId={classId} record={{ is_published: false }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

  expect((await screen.findByRole('alert')).textContent).toContain('network error');
  expect(revalidate).not.toHaveBeenCalled();
});

it.each(['true', 'false'])('keeps the %s submission disabled and busy while pending', async (requestedState) => {
  let resolveRequest!: (response: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
  const isPublishing = requestedState === 'true';
  render(<ClassPublicationButton classId={classId} record={{ is_published: !isPublishing }} />);
  fireEvent.click(screen.getByRole('button', { name: isPublishing ? 'Publish' : 'Unpublish' }));

  const button = await screen.findByRole('button', { name: isPublishing ? 'Publishing…' : 'Unpublishing…' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  fireEvent.click(button);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  resolveRequest(publicationResponse(isPublishing));
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
});

it('retains validation and does not send malformed publication state', async () => {
  const result = await updateClassPublication(previousState, publicationForm('invalid'));
  expect(result.success).toBe(false);
  expect(result.message).toContain('Validation failed');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(revalidate).not.toHaveBeenCalled();
});
