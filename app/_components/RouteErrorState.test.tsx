import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import AppError from '../error';
import GlobalError from '../global-error';
import NotFound from '../not-found';
import CatalogError from '../(public)/kelas/error';
import ParentEnrollmentsError from '../(dashboard)/dashboard/parent/enrollments/error';
import TenantDashboardError from '../(dashboard)/dashboard/tenant/error';
import { RouteErrorState, referenceCode } from './RouteErrorState';

/**
 * Render tests for the route error boundaries and the branded 404 (KEL-48).
 *
 * `renderToStaticMarkup` is used as in the other render tests: the markup is the contract. The
 * retry wiring cannot be clicked in static markup, so the element tree is walked to find the
 * rendered button and its `onClick` is invoked directly.
 */

const SECRET = 'connect ECONNREFUSED 10.0.0.12:5432 password=hunter2';

function boundaryError(digest?: string): Error & { digest?: string } {
  return Object.assign(new Error(SECRET), digest === undefined ? {} : { digest });
}

type Boundary = (props: { error: Error & { digest?: string }; unstable_retry: () => void }) => ReactNode;

const boundaries: Array<[string, Boundary, string]> = [
  ['app/error', AppError, 'Halaman ini belum dapat ditampilkan.'],
  ['kelas/error', CatalogError, 'Katalog kelas belum dapat ditampilkan.'],
  ['parent/enrollments/error', ParentEnrollmentsError, 'Status enrollment belum dapat dimuat.'],
  ['tenant/error', TenantDashboardError, 'Halaman ini belum dapat dimuat.'],
  ['global-error', GlobalError, 'KelolaKelas belum dapat dimuat.'],
];

/** Expands function components until host elements remain, then finds the first `<button>`. */
function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButton(child);
      if (found) return found;
    }
    return null;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function') return findButton((element.type as (p: unknown) => ReactNode)(element.props));
  if (element.type === 'button') return element as unknown as ReactElement<{ onClick: () => void }>;
  return findButton(element.props?.children);
}

describe.each(boundaries)('%s', (_name, Boundary, title) => {
  it('renders an Indonesian recovery screen with a retry button', () => {
    const html = renderToStaticMarkup(<Boundary error={boundaryError()} unstable_retry={() => {}} />);
    expect(html).toContain(title);
    expect(html).toContain('Terjadi kesalahan');
    expect(html).toContain('role="alert"');
    expect(html).toContain('>Coba lagi</button>');
  });

  it('never renders the error message', () => {
    const html = renderToStaticMarkup(<Boundary error={boundaryError('abc123')} unstable_retry={() => {}} />);
    expect(html).not.toContain('ECONNREFUSED');
    expect(html).not.toContain('hunter2');
    expect(html).toContain('Kode referensi: <code>abc123</code>');
  });

  it('wires the retry button to unstable_retry', () => {
    const retry = vi.fn();
    const button = findButton(<Boundary error={boundaryError()} unstable_retry={retry} />);
    expect(button).not.toBeNull();
    button!.props.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('global-error', () => {
  it('renders its own Indonesian document with a title', () => {
    const html = renderToStaticMarkup(<GlobalError error={boundaryError()} unstable_retry={() => {}} />);
    expect(html.startsWith('<html lang="id">')).toBe(true);
    expect(html).toContain('<title>Terjadi kesalahan - KelolaKelas</title>');
  });
});

describe('tenant/error', () => {
  it('renders only a card so the tenant layout navigation stays around it', () => {
    const html = renderToStaticMarkup(<TenantDashboardError error={boundaryError()} unstable_retry={() => {}} />);
    expect(html.startsWith('<section')).toBe(true);
    expect(html).not.toContain('<main');
    expect(html).toContain('href="/login?redirectTo=%2Fdashboard%2Ftenant"');
  });
});

describe('not-found', () => {
  it('renders a branded 404 with links back to the catalog and home', () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain('404 · KelolaKelas');
    expect(html).toContain('Halaman tidak ditemukan.');
    expect(html).toContain('href="/kelas"');
    expect(html).toContain('href="/"');
  });
});

describe('referenceCode', () => {
  it('accepts an opaque digest and rejects anything else', () => {
    expect(referenceCode('1900570969')).toBe('1900570969');
    expect(referenceCode(' abc-DEF_1 ')).toBe('abc-DEF_1');
    expect(referenceCode(undefined)).toBeNull();
    expect(referenceCode('')).toBeNull();
    expect(referenceCode('<script>')).toBeNull();
    expect(referenceCode('a'.repeat(65))).toBeNull();
  });

  it('omits the reference line when there is no usable digest', () => {
    const html = renderToStaticMarkup(<RouteErrorState title="t" description="d" digest="<b>" onRetry={() => {}} />);
    expect(html).not.toContain('Kode referensi');
  });
});
