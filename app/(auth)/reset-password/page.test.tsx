import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./_components/ResetPasswordForm', () => ({
  ResetPasswordForm: ({ token }: { token: string }) => <form><input type="hidden" name="token" value={token} /></form>,
}));

const { default: ResetPasswordPage, metadata } = await import('./page');

describe('reset password page', () => {
  it('does not index the token-bearing URL and refuses external referrers', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('shows the password form with a valid token from the URL', async () => {
    const html = renderToStaticMarkup(await ResetPasswordPage({ searchParams: Promise.resolve({ token: 'abc' }) }));
    expect(html).toContain('name="token" value="abc"');
  });

  it.each([undefined, '  '])('offers a new link when token is missing or blank', async (token) => {
    const html = renderToStaticMarkup(await ResetPasswordPage({ searchParams: Promise.resolve({ token }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).not.toContain('name="token"');
  });
});
