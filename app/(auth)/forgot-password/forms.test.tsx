import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ current: { message: '' } as Record<string, unknown> }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [state.current, vi.fn()],
}));
vi.mock('../reset-password/_actions/actions', () => ({ requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() }));

const { default: ForgotPasswordPage } = await import('./page');
const { RequestResetForm } = await import('./_components/RequestResetForm');
const { ResetPasswordForm } = await import('../reset-password/_components/ResetPasswordForm');
const { LoginForm } = await import('../login/_components/LoginForm');

beforeEach(() => { state.current = { message: '' }; });

describe('password reset screens', () => {
  it('links from login and shows the reset success message', () => {
    const html = renderToStaticMarkup(<LoginForm reset />);
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('Password berhasil diubah');
  });

  it('shows one generic confirmation after request', async () => {
    const html = renderToStaticMarkup(await ForgotPasswordPage({ searchParams: Promise.resolve({ sent: '1' }) }));
    expect(html).toContain('Jika alamat email terdaftar');
    expect(html).not.toContain('name="email"');
  });

  it('labels email and exposes validation errors as alerts', () => {
    state.current = { message: 'Periksa kembali alamat email Anda.', errors: { email: ['Masukkan alamat email yang valid.'] } };
    const html = renderToStaticMarkup(<RequestResetForm />);
    expect(html).toContain('for="reset-email"');
    expect(html).toContain('aria-describedby="reset-email-error"');
    expect(html.match(/role="alert"/g)).toHaveLength(2);
  });

  it('labels both password fields and describes errors', () => {
    state.current = { message: 'Periksa kembali password Anda.', errors: { confirmPassword: ['Konfirmasi password tidak cocok.'] } };
    const html = renderToStaticMarkup(<ResetPasswordForm token="abc" />);
    expect(html).toContain('for="new-password"');
    expect(html).toContain('for="confirm-password"');
    expect(html).toContain('aria-describedby="confirm-error"');
  });

  it('replaces the form with a request-again link for an invalid token', () => {
    state.current = { message: 'Tautan reset tidak valid atau sudah kedaluwarsa.', invalidToken: true };
    const html = renderToStaticMarkup(<ResetPasswordForm token="abc" />);
    expect(html).toContain('href="/forgot-password"');
    expect(html).not.toContain('name="password"');
  });
});
