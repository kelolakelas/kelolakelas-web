import { describe, expect, it } from 'vitest';
import { appSecurityHeaders, BASELINE_HEADERS, buildReportOnlyCsp, REPORT_ONLY_CSP_HEADER_NAME } from './security-headers';

describe('app-owned baseline security headers (KEL-187)', () => {
  it('emits the nosniff/referrer/frame-denial baseline', () => {
    const headers = appSecurityHeaders();
    const byKey = new Map(headers.map((header) => [header.key, header.value]));

    expect(byKey.get('X-Content-Type-Options')).toBe('nosniff');
    expect(byKey.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(byKey.get('X-Frame-Options')).toBe('DENY');
  });

  it('emits each header exactly once so the edge cannot double up', () => {
    const keys = appSecurityHeaders().map((header) => header.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries the CSP as report-only, never enforcing', () => {
    const headers = appSecurityHeaders();
    const byKey = new Map(headers.map((header) => [header.key, header.value]));

    expect(byKey.get(REPORT_ONLY_CSP_HEADER_NAME)).toBe(buildReportOnlyCsp());
    expect(byKey.has('Content-Security-Policy')).toBe(false);
    expect(byKey.has('Strict-Transport-Security')).toBe(false);
  });

  it('keeps frame denial consistent between the header and the CSP', () => {
    const byKey = new Map(appSecurityHeaders().map((header) => [header.key, header.value]));

    expect(byKey.get('X-Frame-Options')).toBe('DENY');
    expect(buildReportOnlyCsp()).toContain("frame-ancestors 'none'");
  });

  it('covers the Next.js/payment inventory without blocking it', () => {
    const csp = buildReportOnlyCsp();

    // QRIS codes render from data: URLs (lib/pay-qr.ts).
    expect(csp).toContain('img-src \'self\' data:');
    // Hosted checkout is a top-level anchor navigation, never a frame.
    expect(csp).toContain("frame-src 'none'");
    // Every form posts back to the app as a Server Action.
    expect(csp).toContain("form-action 'self'");
    // No plugin/object embeds anywhere.
    expect(csp).toContain("object-src 'none'");
  });

  it('emits the CSP as a single line without folding whitespace', () => {
    const csp = buildReportOnlyCsp();

    expect(csp).not.toMatch(/[\r\n\t]/);
    expect(csp).not.toContain('  ');
    for (const directive of csp.split('; ')) {
      expect(directive.trim()).toBe(directive);
    }
  });

  it('keeps the exported baseline in sync with the wired headers', () => {
    const byKey = new Map(appSecurityHeaders().map((header) => [header.key, header.value]));

    for (const { key, value } of BASELINE_HEADERS) {
      expect(byKey.get(key)).toBe(value);
    }
  });
});
