// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Home from './page';

afterEach(cleanup);

describe('landing authentication entry', () => {
  it('links Akses awal directly to login without a modal and preserves other registration CTAs', () => {
    const { getByRole, queryByRole } = render(<Home />);
    const link = getByRole('link', { name: 'Akses awal' });
    expect(link.getAttribute('href')).toBe('/login');
    expect(link.getAttribute('aria-haspopup')).toBeNull();
    expect(link.className).toContain('focus-visible:outline-2');
    expect(queryByRole('button', { name: 'Akses awal' })).toBeNull();
    expect(queryByRole('dialog')).toBeNull();
    expect(getByRole('link', { name: 'Daftar untuk akses awal' }).getAttribute('href')).toBe('/register');
    expect(getByRole('link', { name: 'Gabung pengguna awal' }).getAttribute('href')).toBe('/register');
  });
});
