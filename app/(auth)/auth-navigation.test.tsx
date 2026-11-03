// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login/_components/LoginForm';
import { RegisterFormSwitch } from './register/_components/RegisterFormSwitch';

const actions = vi.hoisted(() => ({ login: vi.fn(), parent: vi.fn(), tenant: vi.fn(), push: vi.fn(), query: '' }));
vi.mock('./login/_actions/actions', () => ({ loginAction: actions.login }));
vi.mock('./register/_actions/actions', () => ({ registerParent: actions.parent, registerTenant: actions.tenant }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: actions.push }),
  useSearchParams: () => new URLSearchParams(actions.query),
}));

beforeEach(() => { vi.resetAllMocks(); actions.query = ''; });
afterEach(cleanup);

describe('secondary authentication navigation', () => {
  it.each(['', 'type=tenant'])('offers login outside the %s registration form without forwarding input or query', query => {
    actions.query = `${query}&redirectTo=https://outside.test&password=not-for-navigation`;
    const { getByRole } = render(<RegisterFormSwitch />);
    const link = getByRole('link', { name: 'Masuk' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.closest('form')).toBeNull();
    expect(link.className).toContain('focus-visible:outline-2');
    expect(getByRole('button', { name: query ? 'Organization Registration' : 'Parent Registration' }).getAttribute('aria-pressed')).toBe('true');
    expect(actions.parent).not.toHaveBeenCalled();
    expect(actions.tenant).not.toHaveBeenCalled();
  });

  it('keeps persona switching and existing query handling unchanged', () => {
    actions.query = 'from=invitation';
    const { getByRole } = render(<RegisterFormSwitch />);
    fireEvent.click(getByRole('button', { name: 'Organization Registration' }));
    expect(actions.push).toHaveBeenCalledWith('/register?from=invitation&type=tenant');
  });

  it('offers registration independently of empty or failed login and preserves existing actions', async () => {
    actions.login.mockResolvedValue({ success: false, message: 'Wrong password' });
    const { getByRole, container } = render(<LoginForm redirectTo="/invitations/verify?token=fixture" />);
    const link = getByRole('link', { name: 'Daftar' });
    expect(link.getAttribute('href')).toBe('/register');
    expect(link.closest('form')).toBeNull();
    expect(link.className).toContain('focus-visible:outline-2');
    expect(actions.login).not.toHaveBeenCalled();
    expect(getByRole('link', { name: 'Lupa password?' }).getAttribute('href')).toBe('/forgot-password');
    expect(getByRole('link', { name: 'Platform admin sign in' }).getAttribute('href')).toBe('/platform/login');
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(getByRole('alert').textContent).toBe('Wrong password'));
    expect(getByRole('link', { name: 'Daftar' }).getAttribute('href')).toBe('/register');
    expect(container.querySelector<HTMLInputElement>('[name="redirectTo"]')!.value).toBe('/invitations/verify?token=fixture');
  });
});
