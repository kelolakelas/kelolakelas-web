import { expect, it, vi } from 'vitest';
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error('redirect'); }) }));
vi.mock('next/navigation', () => ({ redirect }));
import Page from './page';

it('sends legacy bookmarks to the request section in Members', () => {
  expect(() => Page()).toThrow('redirect');
  expect(redirect).toHaveBeenCalledWith('/dashboard/tenant/members#owner-account-request');
});
