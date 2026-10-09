// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login/_components/LoginForm';
import { ParentRegisterForm } from './register/_components/ParentRegisterForm';
import { TenantRegisterForm } from './register/_components/TenantRegisterForm';

const actions = vi.hoisted(() => ({ login: vi.fn(), parent: vi.fn(), tenant: vi.fn(), push: vi.fn() }));
vi.mock('./login/_actions/actions', () => ({ loginAction: actions.login }));
vi.mock('./register/_actions/actions', () => ({ registerParent: actions.parent, registerTenant: actions.tenant }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: actions.push }) }));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

const parentValues = { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', phone: '081234' };
const tenantValues = { ...parentValues, tenant_name: 'Academy', tenant_address: 'Main Street', tenant_phone: '021234' };

describe('auth forms preserve non-secret input after React action reset', () => {
  it.each([
    ['login', LoginForm, actions.login, { email: parentValues.email }],
    ['parent', ParentRegisterForm, actions.parent, parentValues],
    ['tenant', TenantRegisterForm, actions.tenant, tenantValues],
  ] as const)('%s retains edited values over repeated failures and clears password', async (_name, Form, action, values) => {
    action.mockImplementation(async (_previous, data: FormData) => ({
      success: false, message: 'Rejected', errors: { password: ['Password error'] },
      values: Object.fromEntries(Object.keys(values).map(key => [key, data.get(key)])),
    }));
    const { container, getByRole } = render(<Form />);
    const input = (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const [name, value] of Object.entries(values)) fireEvent.change(input(name), { target: { value: value + attempt } });
      fireEvent.change(input('password'), { target: { value: 'temporary-secret' } });
      fireEvent.submit(container.querySelector('form')!);
      await waitFor(() => expect(action).toHaveBeenCalledTimes(attempt + 1));
      await waitFor(() => expect(input('password').value).toBe(''));
      expect(getByRole('alert').textContent).toBe('Rejected');
      for (const [name, value] of Object.entries(values)) expect(input(name).value).toBe(value + attempt);
      expect(input('password').getAttribute('value')).toBeNull();
    }
  });

  it('removes registered banner on login error without losing redirectTo', async () => {
    actions.login.mockResolvedValue({ success: false, message: 'Wrong password', values: { email: parentValues.email } });
    const { container, queryByRole, getByRole } = render(<LoginForm registered redirectTo="/kelas" />);
    expect(getByRole('status').textContent).toContain('Account created successfully');
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(getByRole('alert').textContent).toBe('Wrong password'));
    expect(queryByRole('status')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('[name="redirectTo"]')!.value).toBe('/kelas');
  });

  it.each([
    ['parent', ParentRegisterForm, actions.parent, '/login?registered=1'],
    ['tenant', TenantRegisterForm, actions.tenant, '/dashboard/tenant'],
  ] as const)('%s keeps successful client navigation', async (_name, Form, action, redirectTo) => {
    action.mockResolvedValue({ success: true, message: 'Registered', redirectTo });
    const { container } = render(<Form />);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith(redirectTo));
  });
});
